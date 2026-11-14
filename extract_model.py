import UnityPy, numpy as np, json, struct, io, os, sys, math
from PIL import Image
from UnityPy.helpers.MeshHelper import MeshHandler

SRC = "/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/"
OUT = "/home/agentuser/mlbb-selena/public"
os.makedirs(OUT + "/models", exist_ok=True)
FPS = 30.0

class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.views = []; self.acc = []; self.images = []; self.textures = []
        self.materials = []; self.meshes = []; self.nodes = []; self.skins = []
        self.anims = []
    def _align(self):
        while len(self.bin) % 4: self.bin.append(0)
    def view(self, data, target=None):
        self._align()
        off = len(self.bin); self.bin += data
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target: v["target"] = target
        self.views.append(v); return len(self.views) - 1
    def accessor(self, arr, ctype, atype, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        vi = self.view(arr.tobytes(), target)
        a = {"bufferView": vi, "componentType": ctype, "count": int(arr.shape[0]), "type": atype}
        if minmax:
            a["min"] = [float(x) for x in np.atleast_1d(arr.min(0))]
            a["max"] = [float(x) for x in np.atleast_1d(arr.max(0))]
        self.acc.append(a); return len(self.acc) - 1
    def image(self, pil, fmt="PNG"):
        b = io.BytesIO()
        if fmt == "JPEG":
            pil.convert("RGB").save(b, "JPEG", quality=90); mime = "image/jpeg"
        else:
            pil.save(b, "PNG"); mime = "image/png"
        vi = self.view(b.getvalue())
        self.images.append({"bufferView": vi, "mimeType": mime})
        self.textures.append({"source": len(self.images) - 1, "sampler": 0})
        return len(self.textures) - 1
    def write(self, path):
        doc = {"asset": {"version": "2.0", "generator": "mlbb-selena extractor"},
               "scene": 0, "scenes": [{"nodes": self.root_nodes}],
               "nodes": self.nodes, "meshes": self.meshes, "skins": self.skins,
               "materials": self.materials, "textures": self.textures, "images": self.images,
               "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
               "accessors": self.acc, "bufferViews": self.views,
               "buffers": [{"byteLength": 0}], "animations": self.anims,
               "extensionsUsed": ["KHR_materials_emissive_strength"]}
        self._align()
        doc["buffers"][0]["byteLength"] = len(self.bin)
        j = json.dumps(doc, separators=(",", ":")).encode()
        while len(j) % 4: j += b" "
        total = 12 + 8 + len(j) + 8 + len(self.bin)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(j), 0x4E4F534A)); f.write(j)
            f.write(struct.pack("<II", len(self.bin), 0x004E4942)); f.write(bytes(self.bin))
        return total

def q_unity2gl(q): return (q[0], -q[1], -q[2], q[3])
def p_unity2gl(p): return (-p[0], p[1], p[2])
def mat_unity2gl(m):
    M = np.array([[getattr(m, f"e{r}{c}") for c in range(4)] for r in range(4)], dtype=np.float64)
    S = np.diag([-1, 1, 1, 1.0])
    return (S @ M @ S).astype(np.float32).flatten(order="F")
def vec(v): return (v.X, v.Y, v.Z) if hasattr(v, "X") else (v.x, v.y, v.z)
def quat(q): return (q.X, q.Y, q.Z, q.W) if hasattr(q, "X") else (q.x, q.y, q.z, q.w)

def hermite_eval(keys, t):
    if t <= keys[0][0]: return keys[0][1]
    if t >= keys[-1][0]: return keys[-1][1]
    lo, hi = 0, len(keys) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if keys[mid][0] <= t: lo = mid
        else: hi = mid
    k0, k1 = keys[lo], keys[hi]
    dt = k1[0] - k0[0]
    if dt <= 1e-9: return k1[1]
    m0 = k0[3]; m1 = k1[2]
    if not (math.isfinite(m0) and math.isfinite(m1)): return k0[1]
    s = (t - k0[0]) / dt; s2 = s * s; s3 = s2 * s
    return ((2*s3 - 3*s2 + 1) * k0[1] + (s3 - 2*s2 + s) * m0 * dt + (-2*s3 + 3*s2) * k1[1] + (s3 - s2) * m1 * dt)

def keys_of(curve, getter):
    return [(k.time, getter(k.value), getter(k.inSlope), getter(k.outSlope)) for k in curve.m_Curve]

def export_high(bundle, out_name):
    env = UnityPy.load(SRC + bundle)
    objs = {o.path_id: o for o in env.objects}
    reads = {}
    def R(pid):
        if pid not in reads: reads[pid] = objs[pid].read()
        return reads[pid]
    tf_ids = [pid for pid, o in objs.items() if o.type.name == "Transform"]
    node_of_tf = {pid: i for i, pid in enumerate(tf_ids)}
    g = GLB(); father = {}
    for pid in tf_ids:
        t = R(pid); go = t.m_GameObject.read()
        n = {"name": go.m_Name}
        tr = p_unity2gl(vec(t.m_LocalPosition)); ro = q_unity2gl(quat(t.m_LocalRotation)); sc = vec(t.m_LocalScale)
        if any(abs(a) > 1e-7 for a in tr): n["translation"] = [float(a) for a in tr]
        if any(abs(a - b) > 1e-7 for a, b in zip(ro, (0, 0, 0, 1))): n["rotation"] = [float(a) for a in ro]
        if any(abs(a - 1) > 1e-7 for a in sc): n["scale"] = [float(a) for a in sc]
        ch = [node_of_tf[c.m_PathID] for c in t.m_Children if c.m_PathID in node_of_tf]
        if ch: n["children"] = ch
        g.nodes.append(n)
        for c in ch: father[c] = node_of_tf[pid]
    g.root_nodes = [i for i in range(len(g.nodes)) if i not in father]
    root = g.root_nodes[0]
    print("root:", g.nodes[root]["name"], "nodes:", len(g.nodes), flush=True)
    path_node = {}
    def walk(i, prefix):
        for c in g.nodes[i].get("children", []):
            p = (prefix + "/" if prefix else "") + g.nodes[c]["name"]
            path_node.setdefault(p, c); walk(c, p)
    walk(root, "")
    name_node = {}
    for i, n in enumerate(g.nodes): name_node.setdefault(n["name"], i)

    texs = {}
    for pid, o in objs.items():
        if o.type.name == "Texture2D":
            d = R(pid); texs[d.m_Name] = d.image.convert("RGBA")
    print("textures decoded:", len(texs), flush=True)
    P = "63_selena_skin10_high_"
    def T(n): return texs.get(P + n) or texs.get(n)

    def build_material(name, d, n=None, m=None, e=None, em=None, alpha="OPAQUE", cutoff=0.5,
                       rough=1.0, metal=0.0, emis_g=None, emis_strength=1.0, double=False):
        mat = {"name": name, "doubleSided": double, "alphaMode": alpha}
        if alpha == "MASK": mat["alphaCutoff"] = cutoff
        pbr = {"metallicFactor": metal, "roughnessFactor": rough}
        di = T(d)
        if di is not None:
            opaque = np.asarray(di)[..., 3].min() > 250
            pbr["baseColorTexture"] = {"index": g.image(di.convert("RGB") if opaque else di, "JPEG" if opaque else "PNG")}
        if m and T(m) is not None:
            a = np.asarray(T(m)).astype(np.uint8)
            mr = np.zeros(a.shape[:2] + (3,), np.uint8)
            mr[..., 1] = a[..., 1]; mr[..., 2] = a[..., 0]
            pbr["metallicRoughnessTexture"] = {"index": g.image(Image.fromarray(mr, "RGB"))}
            pbr["metallicFactor"] = 1.0; pbr["roughnessFactor"] = 1.0
        mat["pbrMetallicRoughness"] = pbr
        if n and T(n) is not None:
            mat["normalTexture"] = {"index": g.image(T(n).convert("RGB")), "scale": 1.0}
        if e and T(e) is not None:
            a = np.asarray(T(e))
            ao = np.zeros(a.shape[:2] + (3,), np.uint8); ao[..., 0] = a[..., 0]
            mat["occlusionTexture"] = {"index": g.image(Image.fromarray(ao, "RGB")), "strength": 0.9}
        if em and T(em) is not None:
            mat["emissiveTexture"] = {"index": g.image(T(em).convert("RGB"))}
            mat["emissiveFactor"] = [1, 1, 1]
            mat["extensions"] = {"KHR_materials_emissive_strength": {"emissiveStrength": emis_strength}}
        elif emis_g and T(emis_g) is not None and T(d) is not None:
            ea = np.asarray(T(emis_g))[..., 1].astype(np.float32) / 255.0
            base = np.asarray(T(d).convert("RGB").resize((ea.shape[1], ea.shape[0]))).astype(np.float32)
            emi = (base * ea[..., None]).clip(0, 255).astype(np.uint8)
            mat["emissiveTexture"] = {"index": g.image(Image.fromarray(emi, "RGB"))}
            mat["emissiveFactor"] = [1, 1, 1]
            mat["extensions"] = {"KHR_materials_emissive_strength": {"emissiveStrength": emis_strength}}
        g.materials.append(mat)
        return len(g.materials) - 1

    M = {}
    M["body01"] = build_material("body01", "body01_d", "body01_n", "body01_m", "body01_e", "body01_emissive", emis_strength=3.0)
    M["body02"] = build_material("body02", "body02_d", "body02_n", "body02_m", "body02_e", None, alpha="MASK", cutoff=0.35, emis_g="body02_e", emis_strength=2.0, double=True)
    M["face01"] = build_material("face01", "face01_d", "face01_n", "face01_m", "face01_e", None)
    M["hair01"] = build_material("hair01", "hair01_d", None, None, "hair01_e", None, rough=0.42, emis_g="hair01_e", emis_strength=1.2, double=True)
    M["hair02"] = build_material("hair02", "hair02_d", None, "hair02_m", None, None, double=True)
    M["qunzi"] = build_material("qunzi", "qunzi01_d", "qunzi01_n", "qunzi01_m", None, None, alpha="BLEND", double=True)
    print("materials built", flush=True)

    smr_nodes = {}
    for pid, o in objs.items():
        if o.type.name != "SkinnedMeshRenderer": continue
        s = R(pid); go = s.m_GameObject.read(); mesh = s.m_Mesh.read()
        h = MeshHandler(mesh); h.process()
        verts = np.array(h.m_Vertices, np.float32).reshape(-1, 3)
        nrm = np.array(h.m_Normals, np.float32).reshape(-1, 3) if h.m_Normals else None
        uv = np.array(h.m_UV0, np.float32).reshape(-1, 2) if h.m_UV0 else np.zeros((len(verts), 2), np.float32)
        verts[:, 0] *= -1
        if nrm is not None: nrm[:, 0] *= -1
        uv[:, 1] = 1.0 - uv[:, 1]
        def pad4(rows, dt):
            out = np.zeros((len(rows), 4), dt)
            for r, row in enumerate(rows):
                row = list(row)[:4]; out[r, :len(row)] = row
            return out
        bw = pad4(h.m_BoneWeights, np.float32)
        bi = pad4(h.m_BoneIndices, np.uint16)
        if len(bw) != len(verts): print("   WARN weight count", len(bw), len(verts))
        ssum = bw.sum(1, keepdims=True); ssum[ssum == 0] = 1; bw = bw / ssum
        tris = h.get_triangles()
        pos_acc = g.accessor(verts, 5126, "VEC3", 34962, minmax=True)
        nrm_acc = g.accessor(nrm, 5126, "VEC3", 34962) if nrm is not None else None
        uv_acc = g.accessor(uv, 5126, "VEC2", 34962)
        j_acc = g.accessor(bi, 5123, "VEC4", 34962)
        w_acc = g.accessor(bw, 5126, "VEC4", 34962)
        targets = []; tnames = []
        sh = mesh.m_Shapes
        if sh and len(sh.channels):
            for ch in sh.channels:
                shape = sh.shapes[ch.frameIndex + ch.frameCount - 1]
                dl = np.zeros_like(verts)
                for vv in sh.vertices[shape.firstVertex: shape.firstVertex + shape.vertexCount]:
                    d3 = vec(vv.vertex); dl[vv.index] = (-d3[0], d3[1], d3[2])
                targets.append({"POSITION": g.accessor(dl, 5126, "VEC3", 34962, minmax=True)})
                tnames.append(ch.name)
        mname = s.m_Materials[0].read().m_Name if s.m_Materials else ""
        key = ("qunzi" if "qunzi" in mname else "hair01" if mname.endswith("hair01") else "hair02" if mname.endswith("hair02")
               else "body02" if mname.endswith("body02") else "face01" if mname.endswith("face01") else "body01")
        prims = []
        for sub in tris:
            idx = np.array(sub, np.uint32).reshape(-1, 3)[:, [0, 2, 1]].reshape(-1)
            ia = g.accessor(idx, 5125, "SCALAR", 34963)
            attrs = {"POSITION": pos_acc, "TEXCOORD_0": uv_acc, "JOINTS_0": j_acc, "WEIGHTS_0": w_acc}
            if nrm_acc is not None: attrs["NORMAL"] = nrm_acc
            p = {"attributes": attrs, "indices": ia, "material": M[key]}
            if targets: p["targets"] = targets
            prims.append(p)
        mj = {"name": go.m_Name, "primitives": prims}
        if targets:
            mj["weights"] = [0.0] * len(targets); mj["extras"] = {"targetNames": tnames}
        g.meshes.append(mj)
        joints = [node_of_tf.get(b.m_PathID, root) if b.m_PathID else root for b in s.m_Bones]
        ibm = np.array([mat_unity2gl(m) for m in mesh.m_BindPose], np.float32).reshape(-1, 16)
        ia2 = g.accessor(ibm, 5126, "MAT4")
        g.skins.append({"name": go.m_Name + "_skin", "joints": joints, "inverseBindMatrices": ia2})
        g.nodes.append({"name": go.m_Name + "_mesh", "mesh": len(g.meshes) - 1, "skin": len(g.skins) - 1})
        ni = len(g.nodes) - 1; g.root_nodes.append(ni)
        smr_nodes[go.m_Name] = (ni, len(targets), tnames)
        print(f"  mesh {go.m_Name[-14:]:>14} v={len(verts)} tris={sum(len(x) for x in tris)} bones={len(joints)} morph={len(targets)} mat={key}", flush=True)

    clips = [R(pid) for pid, o in objs.items() if o.type.name == "AnimationClip"]
    unresolved = set()
    for c in clips:
        tracks = []; dur = 0.0
        for rc in c.m_RotationCurves:
            ks = [keys_of(rc.curve, lambda v, i=i: quat(v)[i]) for i in range(4)]
            tracks.append(("rotation", rc.path, ks)); dur = max(dur, ks[0][-1][0])
        for pc in c.m_PositionCurves:
            ks = [keys_of(pc.curve, lambda v, i=i: vec(v)[i]) for i in range(3)]
            tracks.append(("translation", pc.path, ks)); dur = max(dur, ks[0][-1][0])
        floats = []
        for fc in c.m_FloatCurves:
            if fc.attribute.startswith("blendShape."):
                ks = keys_of(fc.curve, lambda v: v)
                floats.append((fc.path, fc.attribute[len("blendShape."):], ks)); dur = max(dur, ks[-1][0])
        nfr = int(math.ceil(dur * FPS)) + 1
        times = np.minimum(np.arange(nfr) / FPS, dur).astype(np.float32)
        samplers = []; channels = []
        tin = g.accessor(times, 5126, "SCALAR", minmax=True)
        t2 = g.accessor(np.array([0, dur], np.float32), 5126, "SCALAR", minmax=True)
        for kind, path, ks in tracks:
            ni = path_node.get(path) or name_node.get(path.split("/")[-1])
            if ni is None: unresolved.add(path); continue
            if kind == "rotation":
                arr = np.array([[hermite_eval(ks[i], float(t)) for i in range(4)] for t in times], np.float64)
                nn = np.linalg.norm(arr, axis=1, keepdims=True); nn[nn == 0] = 1; arr /= nn
                arr[:, 1] *= -1; arr[:, 2] *= -1
                for i in range(1, len(arr)):
                    if np.dot(arr[i], arr[i-1]) < 0: arr[i] *= -1
            else:
                arr = np.array([[hermite_eval(ks[i], float(t)) for i in range(3)] for t in times], np.float64)
                arr[:, 0] *= -1
            at = "VEC4" if kind == "rotation" else "VEC3"
            if np.abs(arr - arr[0]).max() < 1e-6:
                out = g.accessor(np.repeat(arr[:1], 2, 0).astype(np.float32), 5126, at)
                samplers.append({"input": t2, "output": out, "interpolation": "LINEAR"})
            else:
                out = g.accessor(arr.astype(np.float32), 5126, at)
                samplers.append({"input": tin, "output": out, "interpolation": "LINEAR"})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": ni, "path": kind}})
        by_mesh = {}
        for path, attr, ks in floats:
            nm = path.split("/")[-1]
            if nm in smr_nodes: by_mesh.setdefault(nm, {})[attr] = ks
        for nm, attrs in by_mesh.items():
            ni, nt, tn = smr_nodes[nm]
            W = np.zeros((nfr, nt), np.float32)
            for a, ks in attrs.items():
                if a in tn:
                    W[:, tn.index(a)] = [np.clip(hermite_eval(ks, float(t)) / 100.0, 0, 1) for t in times]
            out = g.accessor(W.reshape(-1), 5126, "SCALAR")
            samplers.append({"input": tin, "output": out, "interpolation": "LINEAR"})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": ni, "path": "weights"}})
        g.anims.append({"name": c.m_Name, "samplers": samplers, "channels": channels, "extras": {"duration": float(dur)}})
        print(f"  clip {c.m_Name}: {dur:.2f}s {nfr}f channels={len(channels)}", flush=True)
    if unresolved: print("  unresolved paths:", len(unresolved), list(unresolved)[:5])
    size = g.write(f"{OUT}/models/{out_name}")
    print(f"=> {out_name} {size/1e6:.1f} MB", flush=True)

if __name__ == "__main__":
    export_high("h/hero_selena_skin_high_add.unity3d", "selena_zenith_hd.glb")
