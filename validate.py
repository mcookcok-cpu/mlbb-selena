import json, struct, numpy as np, sys
b=open("public/models/selena_zenith_hd.glb","rb").read()
jl=struct.unpack("<I",b[12:16])[0]; doc=json.loads(b[20:20+jl]); binoff=20+jl+8; BIN=b[binoff:]
def acc(i):
    a=doc["accessors"][i]; v=doc["bufferViews"][a["bufferView"]]
    nc={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}[a["type"]]
    dt={5126:np.float32,5123:np.uint16,5125:np.uint32}[a["componentType"]]
    return np.frombuffer(BIN,dt,a["count"]*nc,v["byteOffset"]).reshape(a["count"],nc)
nodes=doc["nodes"]
def local(n,ov=None):
    t=np.array(n.get("translation",[0,0,0])); r=n.get("rotation",[0,0,0,1]); s=np.array(n.get("scale",[1,1,1]))
    if ov: t=ov.get("t",t); r=ov.get("r",r)
    x,y,z,w=r
    R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    M=np.eye(4); M[:3,:3]=R*s; M[:3,3]=t; return M
def globals_(over=None):
    G=[None]*len(nodes)
    def rec(i,P):
        G[i]=P@local(nodes[i],(over or {}).get(i))
        for c in nodes[i].get("children",[]): rec(c,G[i])
    for r in doc["scenes"][0]["nodes"]:
        if "children" in nodes[r] or "mesh" not in nodes[r]: rec(r,np.eye(4))
        else: G[r]=np.eye(4)
    return G
def skin_bbox(G,mesh_node):
    n0=nodes[mesh_node]; p0=doc['meshes'][n0['mesh']]['primitives'][0]['attributes']; 
    if n0['name'].endswith('leg_01_mesh'): print('   DEBUG leg counts', {k:doc['accessors'][v]['count'] for k,v in p0.items()}, 'joints',len(doc['skins'][n0['skin']]['joints']))
    n=nodes[mesh_node]; sk=doc["skins"][n["skin"]]; p=doc["meshes"][n["mesh"]]["primitives"][0]["attributes"]
    V=acc(p["POSITION"]); J=acc(p["JOINTS_0"]); W=acc(p["WEIGHTS_0"]); IBM=acc(sk["inverseBindMatrices"]).reshape(-1,4,4).transpose(0,2,1)
    JM=np.array([G[j]@IBM[k] for k,j in enumerate(sk["joints"])])
    Vh=np.c_[V,np.ones(len(V))]
    out=np.zeros((len(V),3))
    for k in range(4):
        out+=W[:,k:k+1]*np.einsum("nij,nj->ni",JM[J[:,k]],Vh)[:,:3]
    return out.min(0).round(2),out.max(0).round(2)
G=globals_()
print("REST pose:")
for i,n in enumerate(nodes):
    if "mesh" in n: print(f"  {n['name'][-16:]:>16}", *skin_bbox(G,i))
# animated frame
anim=doc["animations"][4]; print("anim",anim["name"])
tt=None; over={}
for ch in anim["channels"]:
    s=anim["samplers"][ch["sampler"]]; t=acc(s["input"]).ravel(); o=acc(s["output"])
    k=min(int(1.0*30),len(o)-1) if len(o)>2 else 0
    key="t" if ch["target"]["path"]=="translation" else "r" if ch["target"]["path"]=="rotation" else None
    if key: over.setdefault(ch["target"]["node"],{})[key]=o[k] if len(o)>2 else o[0]
G2=globals_(over)
print("ANIM t=1.0s:")
for i,n in enumerate(nodes):
    if "mesh" in n: print(f"  {n['name'][-16:]:>16}", *skin_bbox(G2,i))

print("\n=== per clip, body01 vs body02 center over time ===")
def over_at(anim,frac):
    over={}
    for ch in anim["channels"]:
        s=anim["samplers"][ch["sampler"]]; o=acc(s["output"])
        key="t" if ch["target"]["path"]=="translation" else "r" if ch["target"]["path"]=="rotation" else None
        if not key: continue
        k=0 if len(o)<=2 else int(frac*(len(o)-1))
        over.setdefault(ch["target"]["node"],{})[key]=o[k]
    return over
names={n["name"][-12:]:i for i,n in enumerate(nodes) if "mesh" in n}
b1=[i for i,n in enumerate(nodes) if n.get("name","").endswith("body01_mesh")][0]
b2=[i for i,n in enumerate(nodes) if n.get("name","").endswith("body02_mesh")][0]
bip2=[i for i,n in enumerate(nodes) if n.get("name","").startswith("Bip002")]
for a in doc["animations"]:
    tgt=set(c["target"]["node"] for c in a["channels"])
    print(a["name"],"channels on Bip002 nodes:",len(tgt & set(bip2)),"of",len(bip2))
    for fr in (0,0.25,0.5,0.75,1.0):
        G=globals_(over_at(a,fr)); lo1,hi1=skin_bbox(G,b1); lo2,hi2=skin_bbox(G,b2)
        print(f"   t={fr:.2f} body01 y[{lo1[1]},{hi1[1]}] z[{lo1[2]},{hi1[2]}] | body02 y[{lo2[1]},{hi2[1]}] z[{lo2[2]},{hi2[2]}]")

print("\n=== form 2 pelvis-lock test ===")
def jidx(mesh_name):
    return [i for i,n in enumerate(nodes) if n.get("name","").endswith(mesh_name)][0]
bm=jidx("body02_mesh"); sk=doc["skins"][nodes[bm]["skin"]]
IBM=acc(sk["inverseBindMatrices"]).reshape(-1,4,4).transpose(0,2,1)
pel_k=[k for k,j in enumerate(sk["joints"]) if nodes[j]["name"]=="Bip002 Pelvis"][0]
pel_node=sk["joints"][pel_k]
P_bind=np.linalg.inv(IBM[pel_k])[:3,3]
print("bind pelvis (world, mesh space):",P_bind.round(3))
for a in doc["animations"]:
    for fr in (0,0.5,1.0):
        G=globals_(over_at(a,fr)); P=G[pel_node][:3,3]; D=P_bind-P
        out=[]
        for nm in ("body02_mesh","face02_mesh","hair02_mesh"):
            lo,hi=skin_bbox(G,jidx(nm)); out.append(f"{nm[:4]} y[{lo[1]+D[1]:.2f},{hi[1]+D[1]:.2f}] x[{lo[0]+D[0]:.2f},{hi[0]+D[0]:.2f}] z[{lo[2]+D[2]:.2f},{hi[2]+D[2]:.2f}]")
        print(f"{a['name'][:22]:<22} t={fr:.1f} D={D.round(2)} | "+" | ".join(out))
