/**
 * firebase-compat.js
 * Náhrada Firebase SDK — volá náš Express server místo Firestore/Auth
 * Frontend kód se nemění, jen tato vrstva překládá volání na REST API
 */

(function () {
  'use strict';

  // ── Stav ─────────────────────────────────────────────────────────
  let _currentUser = null;
  let _authListeners = [];
  let _ws = null;
  let _wsReady = false;
  let _wsQueue = [];
  let _snapshotListeners = {}; // klíč → [callback, ...]
  let _snapshotData = {};      // klíč → poslední data
  let _collectionCache = {};   // col → {data, ts}
  const CACHE_TTL = 10000;     // 10s

  // ── WebSocket ─────────────────────────────────────────────────────
  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    _ws = new WebSocket(`${proto}://${location.host}`);

    _ws.onopen = () => {
      _wsReady = true;
      _wsQueue.forEach(m => _ws.send(m));
      _wsQueue = [];
    };

    _ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleWsMessage(msg);
      } catch {}
    };

    _ws.onclose = () => {
      _wsReady = false;
      // Reconnect po 3s
      setTimeout(connectWS, 3000);
    };

    _ws.onerror = () => {};
  }

  function handleWsMessage(msg) {
    const { type, payload } = msg;

    // Invaliduj cache a znovu načti pro posluchače
    const colMap = {
      zakazky_changed:    'zakazky',
      zakaznici_changed:  'zakaznici',
      sklad_changed:      'sklad',
      cenik_changed:      'cenik',
      sablony_changed:    'sablony',
      vykazy_changed:     'vykazy',
      hodnoceni_changed:  'hodnoceni',
      zakazky_typy_changed: 'zakazky_typy',
      users_changed:      'users',
      mista_changed:      null, // handled specially
      klim_changed:       null,
      chat_message:       null,
    };

    if (type in colMap && colMap[type]) {
      const col = colMap[type];
      delete _collectionCache[col];
      // Znovu načti pro všechny snapshot listenery na tuto kolekci
      refreshSnapshotListeners(col);
    } else if (type === 'mista_changed' && payload?.zakazkaId) {
      refreshSnapshotListeners(`zakazky/${payload.zakazkaId}/mista`);
      if (payload.mistaId) {
        refreshSnapshotListeners(`zakazky/${payload.zakazkaId}/mista/${payload.mistaId}/klimatizace`);
      }
    } else if (type === 'klim_changed' && payload?.zakazkaId) {
      refreshSnapshotListeners(`zakazky/${payload.zakazkaId}/mista/${payload.mistaId}/klimatizace`);
    } else if (type === 'chat_message' && payload?.zakazkaId) {
      refreshSnapshotListeners(`zakazky/${payload.zakazkaId}/chat`);
    }
  }

  // ── API helper ────────────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error || 'API chyba'), { code: res.status });
    }
    return res.json();
  }

  // ── Snapshot emulation ────────────────────────────────────────────
  // Klíč = API cesta (např. "zakazky", "zakazky/abc/audit")
  function collectionPathToApi(path) {
    // Převod Firestore path na API path
    return path.replace(/^\/+/, '');
  }

  async function fetchCollection(apiPath) {
    const cached = _collectionCache[apiPath];
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

    const data = await api('GET', '/' + apiPath);
    _collectionCache[apiPath] = { data, ts: Date.now() };
    return data;
  }

  async function refreshSnapshotListeners(colKey) {
    const listeners = _snapshotListeners[colKey];
    if (!listeners?.length) return;

    delete _collectionCache[colKey];
    try {
      const data = await fetchCollection(colKey);
      _snapshotData[colKey] = data;

      // Emuluj Firestore snapshot objekt
      const snap = {
        docs: data.map(item => ({
          id: item.id,
          data: () => ({ ...item }),
          exists: true,
        })),
        empty: data.length === 0,
        size: data.length,
      };
      listeners.forEach(cb => { try { cb(snap); } catch {} });
    } catch (e) {
      console.warn('snapshot refresh failed:', colKey, e);
    }
  }

  // ── Collection reference (emuluje Firestore CollectionRef) ────────
  function makeCollectionRef(path) {
    return {
      _path: path,
      _type: 'collection',
      _filters: [],
      _orderBys: [],
      _limit: null,

      where(field, op, value) {
        const ref = makeCollectionRef(path);
        ref._filters = [...this._filters, { field, op, value }];
        ref._orderBys = [...this._orderBys];
        ref._limit = this._limit;
        return ref;
      },

      orderBy(field, dir) {
        const ref = makeCollectionRef(path);
        ref._filters = [...this._filters];
        ref._orderBys = [...this._orderBys, { field, dir: dir || 'asc' }];
        ref._limit = this._limit;
        return ref;
      },

      limit(n) {
        const ref = makeCollectionRef(path);
        ref._filters = [...this._filters];
        ref._orderBys = [...this._orderBys];
        ref._limit = n;
        return ref;
      },

      async get() {
        let data = await fetchCollection(path);
        // Aplikuj filtry
        for (const f of this._filters) {
          data = data.filter(item => {
            const v = item[f.field];
            if (f.op === '==') return v === f.value;
            if (f.op === '!=') return v !== f.value;
            if (f.op === '>') return v > f.value;
            if (f.op === '<') return v < f.value;
            if (f.op === '>=') return v >= f.value;
            if (f.op === '<=') return v <= f.value;
            if (f.op === 'array-contains') return Array.isArray(v) && v.includes(f.value);
            return true;
          });
        }
        // Řazení
        for (const o of this._orderBys) {
          data.sort((a, b) => {
            const av = a[o.field], bv = b[o.field];
            if (av === bv) return 0;
            const r = av < bv ? -1 : 1;
            return o.dir === 'desc' ? -r : r;
          });
        }
        if (this._limit) data = data.slice(0, this._limit);

        return {
          docs: data.map(item => ({
            id: item.id,
            data: () => ({ ...item }),
            exists: true,
          })),
          empty: data.length === 0,
          size: data.length,
        };
      },

      onSnapshot(callback) {
        const key = path;
        if (!_snapshotListeners[key]) _snapshotListeners[key] = [];
        _snapshotListeners[key].push(callback);

        // Ihned načti
        fetchCollection(path).then(data => {
          const snap = {
            docs: data.map(item => ({
              id: item.id,
              data: () => ({ ...item }),
              exists: true,
            })),
            empty: data.length === 0,
            size: data.length,
          };
          try { callback(snap); } catch {}
        }).catch(() => {
          try { callback({ docs: [], empty: true, size: 0 }); } catch {}
        });

        // Vrať unsubscribe funkci
        return () => {
          _snapshotListeners[key] = (_snapshotListeners[key] || []).filter(cb => cb !== callback);
        };
      },

      async add(data) {
        const result = await api('POST', '/' + path, data);
        delete _collectionCache[path];
        return makeDocRef(path, result.id);
      },
    };
  }

  // ── Document reference ────────────────────────────────────────────
  function makeDocRef(colPath, docId) {
    const fullPath = `${colPath}/${docId}`;
    return {
      id: docId,
      _path: fullPath,
      _colPath: colPath,
      _type: 'doc',

      collection(subCol) {
        return makeCollectionRef(`${fullPath}/${subCol}`);
      },

      async get() {
        try {
          const data = await api('GET', '/' + fullPath);
          return { id: docId, data: () => data, exists: !!data };
        } catch (e) {
          if (e.code === 404) return { id: docId, data: () => null, exists: false };
          throw e;
        }
      },

      async set(data, opts) {
        if (opts?.merge) {
          await api('PUT', '/' + fullPath, data);
        } else {
          await api('PUT', '/' + fullPath, data);
        }
        delete _collectionCache[colPath];
        return this;
      },

      async update(data) {
        await api('PUT', '/' + fullPath, data);
        delete _collectionCache[colPath];
        return this;
      },

      async delete() {
        await api('DELETE', '/' + fullPath);
        delete _collectionCache[colPath];
      },
    };
  }

  // ── Auth emulation ─────────────────────────────────────────────────
  const _auth = {
    currentUser: null,

    async signInWithEmailAndPassword(email, password) {
      const user = await api('POST', '/auth/login', { email, password });
      _currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        firma: user.firma,
        approved: user.approved,
        getIdToken: async () => 'local-token',
      };
      _auth.currentUser = _currentUser;
      window._currentUser = _currentUser;
      window._userRole = user.role;
      window._currentFirma = user.firma;
      _authListeners.forEach(cb => cb(_currentUser));
      connectWS();
      return { user: _currentUser };
    },

    async createUserWithEmailAndPassword(email, password) {
      const displayName = window._registerDisplayName || '';
      const firma = window._registerFirma || 'ac';
      const result = await api('POST', '/auth/register', { email, password, displayName, firma });
      if (result.pending) {
        // Čeká na schválení — vrátíme "user" ale přihlásíme ho až po schválení
        throw Object.assign(new Error(result.message), { code: 'auth/pending-approval', pending: true });
      }
      _currentUser = {
        uid: result.uid,
        email: result.email,
        displayName: result.displayName,
        role: result.role,
        firma: result.firma,
        approved: result.approved,
        getIdToken: async () => 'local-token',
      };
      _auth.currentUser = _currentUser;
      window._currentUser = _currentUser;
      window._userRole = result.role;
      window._currentFirma = result.firma;
      _authListeners.forEach(cb => cb(_currentUser));
      connectWS();
      return { user: _currentUser };
    },

    async signOut() {
      await api('POST', '/auth/logout');
      _currentUser = null;
      _auth.currentUser = null;
      window._currentUser = null;
      if (_ws) { _ws.close(); _ws = null; }
      _collectionCache = {};
      _snapshotListeners = {};
      _authListeners.forEach(cb => cb(null));
    },

    onAuthStateChanged(callback) {
      _authListeners.push(callback);
      // Ověř session při načtení stránky - s retry
      const checkSession = (attempt) => {
        fetch('/api/auth/me', { credentials: 'include' })
          .then(res => {
            if (!res.ok) throw new Error('unauthorized');
            return res.json();
          })
          .then(user => {
            _currentUser = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              role: user.role,
              firma: user.firma,
              approved: user.approved,
              getIdToken: async () => 'local-token',
            };
            _auth.currentUser = _currentUser;
            window._currentUser = _currentUser;
            window._userRole = user.role;
            window._currentFirma = user.firma;
            console.log('[ServisAC] přihlášen:', user.email, '| role:', user.role);
            callback(_currentUser);
            connectWS();
          })
          .catch(() => {
            if (attempt < 3) {
              setTimeout(() => checkSession(attempt + 1), 500);
            } else {
              callback(null);
            }
          });
      };
      checkSession(0);
      return () => {
        _authListeners = _authListeners.filter(cb => cb !== callback);
      };
    },
  };

  // ── Databáze emulation ─────────────────────────────────────────────
  const _db = {
    collection(path) {
      return makeCollectionRef(path);
    },
    doc(col, id) {
      return makeDocRef(col, id);
    },
  };

  // ── Storage emulation (base64 upload) ─────────────────────────────
  const _storage = {
    _pending: {},

    ref(path) {
      return {
        _path: path,
        async put(blob) {
          // Převeď blob na base64
          const dataUrl = await new Promise((res) => {
            const reader = new FileReader();
            reader.onload = e => res(e.target.result);
            reader.readAsDataURL(blob);
          });
          const result = await api('POST', '/upload/base64', { dataUrl, filename: path });
          _storage._pending[path] = result.url;
          return { ref: this };
        },
        async putString(dataUrl, format) {
          const result = await api('POST', '/upload/base64', { dataUrl, filename: path });
          _storage._pending[path] = result.url;
          return { ref: this };
        },
        async getDownloadURL() {
          return _storage._pending[this._path] || this._path;
        },
      };
    },
  };

  // ── window._fb — stejné rozhraní jako před refaktorem ─────────────
  window._fb = {
    auth: _auth,
    db:   _db,
    storage: _storage,

    // Auth
    signInWithEmailAndPassword: (a, e, p) => _auth.signInWithEmailAndPassword(e, p),
    signOut: (a) => _auth.signOut(),
    createUserWithEmailAndPassword: (a, e, p) => _auth.createUserWithEmailAndPassword(e, p),
    onAuthStateChanged: (a, cb) => _auth.onAuthStateChanged(cb),
    updateProfile: (user, data) => {
      return api('PUT', `/users/${user.uid}`, { displayName: data.displayName });
    },

    // Firestore
    collection: (db, col) => {
      if (typeof db === 'string') return makeCollectionRef(db);
      return db.collection(col);
    },
    doc: (db, col, id) => {
      if (typeof col === 'string' && typeof id === 'string') {
        return makeDocRef(col, id);
      }
      if (typeof db === 'string') {
        // doc(db, col, id) kde db je string path
        return makeDocRef(db, col);
      }
      return db.doc(col, id);
    },
    addDoc: (colRef, data) => colRef.add(data),
    setDoc: (docRef, data, opts) => docRef.set(data, opts),
    updateDoc: (docRef, data) => docRef.update(data),
    deleteDoc: (docRef) => docRef.delete(),
    getDoc:  (docRef) => docRef.get(),
    getDocs: (colRef) => colRef.get(),
    onSnapshot: (ref, cb) => ref.onSnapshot(cb),

    // Query helpers — vrátí upravenou kolekci
    query: (base, ...fns) => {
      let q = base;
      for (const fn of fns) {
        if (typeof fn === 'function') q = fn(q);
      }
      return q;
    },
    where:   (f, op, v) => (q) => q.where(f, op, v),
    orderBy: (f, d)     => (q) => q.orderBy(f, d),
    limit:   (n)        => (q) => q.limit(n),

    // Timestamp (uložíme jako null, server doplní)
    serverTimestamp: () => null,
    Timestamp: { fromDate: (d) => d?.getTime() || Date.now() },
    FieldValue: { serverTimestamp: () => null, arrayUnion: (...v) => v, arrayRemove: (...v) => v },

    // Storage
    ref:           (s, path) => _storage.ref(path),
    uploadBytes:   (ref, bytes) => ref.put(bytes),
    uploadString:  (ref, str, fmt) => ref.putString(str, fmt),
    getDownloadURL:(ref) => ref.getDownloadURL(),
  };

  // Zpřístupni auth
  window._auth = _auth;

  console.log('✓ Firebase compatibility layer načten (SQLite backend)');

})();
