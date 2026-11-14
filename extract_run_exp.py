#!/usr/bin/env python3
# EKSPERIMENTAL: ekstrak klip lokomotif ASLI (run, fastrun, dst) dari hero_selena_skin.unity3d (rig low-poly).
# Klip ini bukan Mecanim-muscle humanoid: isinya kurva Transform generik (posisi attr=1, rotasi attr=2) yang
# disimpan di DenseClip + ConstantClip. Hasil: public/models/run_exp.json (per NAMA tulang, sudah dikonversi
# ke sistem koordinat glTF/three.js seperti extract_model.py: posisi x dibalik, kuaternion y & z dibalik).
import UnityPy, zlib, json, struct, sys
import numpy as np

B = "/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/h/"
GLB = "/home/agentuser/mlbb-selena/public/models/selena_zenith_hd.glb"
OUT = "/home/agentuser/mlbb-selena/public/models/run_exp.json"
WANT = sys.argv[1:] or ["run", "fastrun"]

d = open(GLB, "rb").read()
l = struct.unpack("<I", d[12:16])[0]
j = json.loads(d[20:20 + l])
N = j["nodes"]; par = {}
for i, n in enumerate(N):
    for c in n.get("children", []): par[c] = i
def gpath(i):
    p = []
    while i is not None: p.append(N[i]["name"]); i = par.get(i)
    return "/".join(reversed(p))
cands = {gpath(i) for i in range(len(N))}
env = UnityPy.load(B + "hero_selena_skin.unity3d")
tr = {o.path_id: o.read() for o in env.objects if o.type.name == "Transform"}
def tname(t): return t.m_GameObject.read().m_Name
def tpath(t):
    s = []
    while t: s.append(tname(t)); t = t.m_Father.read() if t.m_Father and t.m_Father.path_id else None
    return "/".join(reversed(s))
cands |= {tpath(t) for t in tr.values()}
H = {}
for p in cands:
    segs = p.split("/")
    for k in range(len(segs)):
        s = "/".join(segs[k:]); H.setdefault(zlib.crc32(s.encode()) & 0xffffffff, s)

hd_names = {n["name"] for n in N}
hd_rest = {n["name"]: n.get("translation") for n in N}

out = {"source": "hero_selena_skin.unity3d", "note": "eksperimental: klip lokomotif asli game, curve Transform generik", "clips": []}
for o in env.objects:
    if o.type.name != "AnimationClip": continue
    c = o.read()
    if c.m_Name not in WANT: continue
    mc = c.m_MuscleClip; cl = mc.m_Clip.data
    assert cl.m_StreamedClip.curveCount == 0, "klip punya streamed curve: belum didukung"
    dc = cl.m_DenseClip; kc = cl.m_ConstantClip.data
    nF, nC, sr = dc.m_FrameCount, dc.m_CurveCount, float(dc.m_SampleRate)
    dense = np.array(dc.m_SampleArray, np.float64).reshape(nF, nC)
    const = np.array(kc, np.float64)
    stop = float(mc.m_StopTime)
    nUse = min(nF, int(round(stop * sr)) + 1)
    times = np.arange(nUse) / sr
    gb = c.m_ClipBindingConstant.genericBindings
    idx = 0; tracks = []; unresolved = []; names = set()
    def col(k):
        if k < nC: return dense[:nUse, k]
        return np.full(nUse, const[k - nC])
    for b in gb:
        assert b.typeID == 4 and b.attribute in (1, 2), (b.typeID, b.attribute)
        n = 3 if b.attribute == 1 else 4
        cols = np.stack([col(idx + i) for i in range(n)], 1); idx += n
        full = H.get(b.path)
        if full is None: unresolved.append((hex(b.path), "pos" if b.attribute == 1 else "rot")); continue
        name = full.split("/")[-1]
        if b.attribute == 1:
            cols = cols.copy(); cols[:, 0] *= -1; kind = "position"
        else:
            nn = np.linalg.norm(cols, axis=1, keepdims=True); nn[nn == 0] = 1; cols = cols / nn
            cols[:, 1] *= -1; cols[:, 2] *= -1; kind = "quaternion"
            for i in range(1, len(cols)):
                if np.dot(cols[i], cols[i - 1]) < 0: cols[i] *= -1
        names.add(name)
        tracks.append({"bone": name, "path": kind, "values": [round(float(x), 6) for x in cols.flatten()]})
    assert idx == nC + len(const), (idx, nC + len(const))
    loopdiff = float(np.abs(dense[0] - dense[min(nF - 1, nUse)]).max()) if nF > nUse else None
    inHD = sum(1 for n in names if n in hd_names)
    print(f"clip {c.m_Name}: stop={stop:.3f}s frames={nF} dipakai={nUse} sr={sr} bindings={len(gb)} "
          f"resolved={len(tracks)} unresolved={len(unresolved)} bone_ada_di_HD={inHD}/{len(names)} loop_diff={loopdiff}")
    if unresolved: print("   unresolved:", unresolved[:6])
    out["clips"].append({"name": c.m_Name, "duration": stop, "fps": sr, "loop": bool(mc.m_LoopTime), "times": [round(float(t), 6) for t in times],
                         "tracks": tracks, "unresolved": len(unresolved)})
    for t in tracks:
        if t["bone"] in ("Bip001 Pelvis", "Bip001 L Thigh") and t["path"] == "position":
            v = t["values"][:3]; print("   pos", t["bone"], "klip f0 =", [round(x, 4) for x in v], "| HD rest =", hd_rest.get(t["bone"]))

json.dump(out, open(OUT, "w"), separators=(",", ":"))
print("tersimpan", OUT, round(len(open(OUT).read()) / 1024, 1), "KB")
