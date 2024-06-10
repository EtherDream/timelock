async function pbkdf2(pwd, opts) {
    const k = await crypto.subtle.importKey('raw', pwd, 'PBKDF2', false, ['deriveBits']);
    const buf = await crypto.subtle.deriveBits(opts, k, 256);
    return new Uint32Array(buf);
}
async function aesEncrypt(plain, key, iv) {
    const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, plain);
    return new Uint8Array(buf);
}
async function aesDecrypt(cipher, key, iv) {
    const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, cipher);
    return new Uint8Array(buf);
}
function xorArr(dst, src) {
    for (let i = 0; i < src.length; i++) {
        dst[i] ^= src[i];
    }
}
/**
 * this function will run in the worker
 */
async function workerOnMessage(e) {
    const { threadId, baseId, costThisThread, seed, salt, } = e.data;
    const saltU32 = new Uint32Array(salt.buffer);
    const pbkdf2Params = {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: saltU32,
        iterations: 1e7,
    };
    let hash = Uint32Array.of(seed);
    for (let i = 0; i < costThisThread; i++) {
        const k = await crypto.subtle.importKey('raw', hash, 'PBKDF2', false, ['deriveBits']);
        const pbkdfId = baseId + i;
        saltU32[0] ^= pbkdfId;
        const buf = await crypto.subtle.deriveBits(pbkdf2Params, k, 256);
        saltU32[0] ^= pbkdfId;
        hash = new Uint32Array(buf);
        postMessage({
            threadId,
            progress: i,
            hash,
        });
    }
    postMessage({
        threadId,
        progress: -1,
        hash
    });
}
let workerUrl;
const workerPool = [];
function allocWorker() {
    if (!workerUrl) {
        const code = 'onmessage=' + workerOnMessage;
        const blob = new Blob([code]);
        workerUrl = URL.createObjectURL(blob);
    }
    return workerPool.pop() || new Worker(workerUrl);
}
function freeWorker(worker) {
    worker.onmessage = null;
    workerPool.push(worker);
}
export function encrypt(params, onProgress) {
    const { plain, cost, cpuThread } = params;
    const threadNumAvail = Math.min(cpuThread, cost);
    const costPreThread = Math.ceil(cost / threadNumAvail);
    const threadNum = Math.ceil(cost / costPreThread);
    const costLastThread = costPreThread - (threadNum * costPreThread - cost);
    const seeds = new Uint32Array(threadNum);
    crypto.getRandomValues(seeds);
    const salt = crypto.getRandomValues(new Uint8Array(8));
    const hashes = [];
    let completedCost = 0;
    const onMsg = async function (e) {
        const { threadId, progress, hash } = e.data;
        if (progress !== -1) {
            onProgress(++completedCost, threadId, hash);
            return;
        }
        hashes[threadId] = hash;
        freeWorker(this);
        if (completedCost !== cost) {
            return;
        }
        //
        // all threads completed
        //
        let key = hashes[0];
        for (let i = 1; i < threadNum; i++) {
            seeds[i] ^= key[0];
            xorArr(key, hashes[i]);
        }
        const cipher = await aesEncrypt(plain, key, new Uint8Array(16));
        const output = {
            cipher, cost, salt,
            seeds: new Uint8Array(seeds.buffer),
        };
        onComplete(output);
    };
    for (let i = 0; i < threadNum; i++) {
        const worker = allocWorker();
        worker.onmessage = onMsg;
        worker.postMessage({
            threadId: i,
            baseId: costPreThread * i,
            seed: seeds[i],
            salt,
            costThisThread: (i === threadNum - 1) ? costLastThread : costPreThread,
        });
    }
    let onComplete;
    return new Promise(resolve => {
        onComplete = resolve;
    });
}
export async function decrypt(params, onProgress) {
    const { cipher, cost } = params;
    const seeds = new Uint32Array(params.seeds.buffer);
    const salt = new Uint32Array(params.salt.buffer);
    const pbkdf2Params = {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt,
        iterations: 1e7,
    };
    let pbkdfId = 0;
    const parall = seeds.length;
    const costPreThread = Math.ceil(cost / parall);
    const costLastThread = costPreThread - (parall * costPreThread - cost);
    // slow_hash 1st seed
    let hash = Uint32Array.of(seeds[0]);
    for (let i = 0; i < costPreThread; i++) {
        salt[0] ^= pbkdfId;
        hash = await pbkdf2(hash, pbkdf2Params);
        salt[0] ^= pbkdfId;
        if (onProgress(++pbkdfId, hash) === false) {
            return;
        }
    }
    let key = hash;
    // slow_hash 2nd+ seeds
    for (let p = 1; p < parall; p++) {
        const costThisThread = (p === parall - 1) ? costLastThread : costPreThread;
        const seed = seeds[p] ^ key[0];
        hash = Uint32Array.of(seed);
        for (let i = 0; i < costThisThread; i++) {
            salt[0] ^= pbkdfId;
            hash = await pbkdf2(hash, pbkdf2Params);
            salt[0] ^= pbkdfId;
            if (onProgress(++pbkdfId, hash) === false) {
                return;
            }
        }
        xorArr(key, hash);
    }
    try {
        return await aesDecrypt(cipher, key, new Uint8Array(16));
    }
    catch {
        throw Error('decrypt failed');
    }
}
