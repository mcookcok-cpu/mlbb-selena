// Animasi lokomotif PROSEDURAL (jalan / lari / lari cepat) untuk rig Bip001 & Bip002 model HD.
// Bukan klip asli game: klip run/attack/skill game memakai Mecanim muscle (humanoid) sehingga tidak ikut diekspor.
// Cara kerja: arah tiap segmen tulang ditentukan di ruang dunia dari pose istirahat, lalu dikonversi ke rotasi lokal
// (jadi tidak bergantung pada orientasi sumbu lokal biped). Pelvis diturunkan tiap frame agar kaki terendah tetap menapak.
export function makeLocomotionClips(THREE, root) {
  const { Vector3: V3, Quaternion: Q } = THREE;
  const san = n => THREE.PropertyBinding.sanitizeNodeName(n);
  const get = n => root.getObjectByName(san(n));
  const UP = new V3(0, 1, 0);
  const NAMES = { pelvis: 'Pelvis', spine: 'Spine', spine1: 'Spine1', spine2: 'Spine2', neck: 'Neck', head: 'Head',
    lTh: 'L Thigh', lCa: 'L Calf', lFo: 'L Foot', lTo: 'L Toe0', rTh: 'R Thigh', rCa: 'R Calf', rFo: 'R Foot', rTo: 'R Toe0',
    lUa: 'L UpperArm', lFa: 'L Forearm', lHa: 'L Hand', rUa: 'R UpperArm', rFa: 'R Forearm', rHa: 'R Hand',
    lUaT: 'LUpArmTwist', lFaT: 'L ForeTwist', rUaT: 'RUpArmTwist', rFaT: 'R ForeTwist' };
  const GAITS = {
    loco_walk:   { T: 1.05, th: 0.40, k0: 0.08, k1: 0.55, kp: -0.10, lean: 0.04, arm: 0.30, e0: 0.22, e1: 0.25, tw: 0.12, ab: 0.12, foot: 0.12 },
    loco_run:    { T: 0.66, th: 0.70, k0: 0.35, k1: 1.15, kp: -0.10, lean: 0.20, arm: 0.85, e0: 1.30, e1: 0.30, tw: 0.28, ab: 0.18, foot: 0.25 },
    loco_sprint: { T: 0.50, th: 0.85, k0: 0.45, k1: 1.30, kp: -0.10, lean: 0.34, arm: 1.05, e0: 1.40, e1: 0.35, tw: 0.34, ab: 0.20, foot: 0.30 },
  };
  root.updateMatrixWorld(true);

  // ---- siapkan tiap rangka + data pose istirahat
  const skels = [];
  for (const pre of ['Bip001', 'Bip002']) {
    const S = { pre };
    for (const [k, n] of Object.entries(NAMES)) S[k] = get(`${pre} ${n}`);
    if (!Object.entries(S).every(([k, v]) => k === 'pre' || v)) continue;
    S.sub = new Set(); S.pelvis.traverse(o => S.sub.add(o));
    S.rest = new Map();
    S.pelvis.traverse(o => S.rest.set(o, { q: o.quaternion.clone(), p: o.position.clone(), wq: o.getWorldQuaternion(new Q()), wp: o.getWorldPosition(new V3()) }));
    const h = v => { v = v.clone(); v.y = 0; return v.normalize(); };
    const R = o => S.rest.get(o);
    S.Lft = h(R(S.lTh).wp.clone().sub(R(S.rTh).wp));
    S.F = h(R(S.lTo).wp.clone().sub(R(S.lFo).wp));
    S.A = new V3().crossVectors(S.F, UP).normalize();            // rotasi + terhadap A: tungkai/lengan terayun ke depan
    S.sT = Math.sign(new V3().crossVectors(UP, S.Lft).dot(S.F)) || 1; // tanda putaran sumbu-Y yang memajukan pinggul kiri
    S.dir = (a, b) => R(b).wp.clone().sub(R(a).wp).normalize();
    const sep0 = Math.abs(R(S.lFo).wp.clone().sub(R(S.rFo).wp).dot(S.Lft)); // jarak antar-pergelangan saat berdiri
    S.abd = 0.03 + 0.12 * Math.min(1, Math.max(0, 1 - sep0 / 0.18));   // makin rapat kakinya, makin dilebarkan
    S.upOk = R(S.head).wp.clone().sub(R(S.pelvis).wp).normalize().y;
    if (S.upOk < 0.8) continue; // rangka tidak berdiri tegak di ruang dunia: lewati
    skels.push(S);
  }
  if (!skels.length) return [];

  const rot = (axis, a) => new Q().setFromAxisAngle(axis, a);
  const swing = (S, a, v) => v.clone().applyQuaternion(rot(S.A, a));

  // ---- pose: peta tulang -> kuaternion dunia yang diinginkan
  function pose(S, g, phi) {
    const D = new Map(), R = o => S.rest.get(o);
    const lean = g.lean, tw = g.tw * Math.sin(phi) * S.sT;
    const torso = (psi, fr) => rot(UP, psi).multiply(rot(S.A, -lean * fr));
    const put = (o, q) => D.set(o, q.multiply(R(o).wq));
    put(S.pelvis, torso(-tw * 0.5, 0.2)); put(S.spine, torso(-tw * 0.25, 0.45)); put(S.spine1, torso(tw * 0.25, 0.75));
    put(S.spine2, torso(tw * 0.6, 1)); put(S.neck, torso(tw * 0.6, 0.6)); put(S.head, torso(tw * 0.3, 0.15));
    const Rt = torso(tw * 0.6, 1);
    for (const L of [true, false]) {
      const p = L ? phi : phi + Math.PI, s = L ? 'l' : 'r', sn = Math.sin(p);
      const th = g.th * sn + 0.05, kf = g.k0 + g.k1 * Math.pow(Math.max(0, Math.cos(p + g.kp)), 1.5);
      const lout = L ? S.Lft : S.Lft.clone().negate(); // sedikit melebar ke luar supaya kaki tidak saling menembus saat berpapasan
      const dTh = swing(S, th, S.dir(S[s + 'Th'], S[s + 'Ca'])).addScaledVector(lout, S.abd).normalize(), dCa = swing(S, th - kf, S.dir(S[s + 'Ca'], S[s + 'Fo'])).addScaledVector(lout, S.abd * 0.7).normalize();
      D.set(S[s + 'Th'], new Q().setFromUnitVectors(S.dir(S[s + 'Th'], S[s + 'Ca']), dTh).multiply(R(S[s + 'Th']).wq));
      D.set(S[s + 'Ca'], new Q().setFromUnitVectors(S.dir(S[s + 'Ca'], S[s + 'Fo']), dCa).multiply(R(S[s + 'Ca']).wq));
      put(S[s + 'Fo'], rot(S.A, sn > 0 ? g.foot * sn : 1.3 * g.foot * sn));
      const ab = g.ab, out = L ? S.Lft : S.Lft.clone().negate();
      const stance = UP.clone().negate().multiplyScalar(Math.cos(ab)).addScaledVector(out, Math.sin(ab)).normalize();
      const ta = -g.arm * sn, el = g.e0 + g.e1 * Math.max(0, ta / g.arm);
      const dUa = swing(S, ta, stance).applyQuaternion(Rt), dFa = swing(S, ta + el, stance).applyQuaternion(Rt);
      D.set(S[s + 'Ua'], new Q().setFromUnitVectors(S.dir(S[s + 'Ua'], S[s + 'Fa']), dUa).multiply(R(S[s + 'Ua']).wq));
      D.set(S[s + 'Fa'], new Q().setFromUnitVectors(S.dir(S[s + 'Fa'], S[s + 'Ha']), dFa).multiply(R(S[s + 'Fa']).wq));
      for (const [f, m] of [['UaT', 'Ua'], ['FaT', 'Fa']]) { // tulang twist ikut rotasi tulang utamanya
        const dm = D.get(S[s + m]).clone().multiply(R(S[s + m]).wq.clone().invert());
        D.set(S[s + f], dm.multiply(R(S[s + f]).wq));
      }
    }
    return D;
  }

  // ---- kuaternion dunia -> kuaternion lokal (FK dari pelvis ke bawah)
  function locals(S, D) {
    const memo = new Map();
    const nw = o => {
      if (memo.has(o)) return memo.get(o);
      let q;
      if (D.has(o)) q = D.get(o);
      else if (!S.sub.has(o)) q = o.getWorldQuaternion(new Q()); // leluhur pelvis: tidak dianimasikan
      else q = nw(o.parent).clone().multiply(S.rest.get(o).q);
      memo.set(o, q); return q;
    };
    const out = new Map();
    for (const [o, q] of D) out.set(o, nw(o.parent).clone().invert().multiply(q));
    return out;
  }

  const clips = [];
  const FPS = 30;
  for (const [name, g] of Object.entries(GAITS)) {
    const N = Math.max(24, Math.round(g.T * FPS)), times = [];
    for (let i = 0; i <= N; i++) times.push(g.T * i / N);
    const qv = new Map(), pv = new Map(); // nilai kuaternion per tulang, posisi pelvis per skeleton
    for (const S of skels) {
      const restAnkle = Math.min(S.rest.get(S.lFo).wp.y, S.rest.get(S.rFo).wp.y);
      const par = S.pelvis.parent, parInv = par.matrixWorld.clone().invert();
      const restP = S.rest.get(S.pelvis).p;
      pv.set(S, []);
      for (let i = 0; i <= N; i++) {
        const phi = 2 * Math.PI * (i % N) / N;
        const L = locals(S, pose(S, g, phi));
        for (const [o, q] of L) { // simpan (jaga hemisfer kuaternion supaya slerp tidak berbalik)
          const arr = qv.get(o) || []; const prev = arr[arr.length - 1];
          const qq = q.clone(); if (prev && prev.dot(qq) < 0) { qq.x *= -1; qq.y *= -1; qq.z *= -1; qq.w *= -1; }
          arr.push(qq); qv.set(o, arr);
        }
        // ukur tinggi pergelangan pada pose ini lalu turunkan pelvis agar kaki terendah menapak
        const saved = [...L.keys()].map(o => [o, o.quaternion.clone()]);
        for (const [o, q] of L) o.quaternion.copy(q);
        root.updateMatrixWorld(true);
        const ay = Math.min(S.lFo.getWorldPosition(new V3()).y, S.rFo.getWorldPosition(new V3()).y);
        for (const [o, q] of saved) o.quaternion.copy(q);
        root.updateMatrixWorld(true);
        const off = new V3(0, restAnkle - ay, 0), len = off.length();
        const lp = len ? off.transformDirection(parInv).multiplyScalar(len) : off;
        pv.get(S).push(restP.clone().add(lp));
      }
    }
    const tracks = [];
    for (const [o, arr] of qv) tracks.push(new THREE.QuaternionKeyframeTrack(`${o.name}.quaternion`, times, arr.flatMap(q => [q.x, q.y, q.z, q.w])));
    for (const [S, arr] of pv) tracks.push(new THREE.VectorKeyframeTrack(`${S.pelvis.name}.position`, times, arr.flatMap(v => [v.x, v.y, v.z])));
    clips.push(new THREE.AnimationClip(name, g.T, tracks));
  }
  return clips;
}
