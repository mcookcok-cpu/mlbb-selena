import UnityPy
B="/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/"
env=UnityPy.load(B+"h/hero_selena_skin_high_add.unity3d")
objs={o.path_id:o for o in env.objects}
tf={pid:o.read() for pid,o in objs.items() if o.type.name=="Transform"}
def v(a): return tuple(round(float(getattr(a,k)),3) for k in (("x","y","z","w") if hasattr(a,"w") else ("x","y","z")))
def name(pid): return tf[pid].m_GameObject.read().m_Name
def path(pid):
    p=[]
    while pid and pid in tf:
        p.append(name(pid)); f=tf[pid].m_Father; pid=f.m_PathID if f else 0
    return "/".join(reversed(p))
roots=[pid for pid,t in tf.items() if not t.m_Father or not t.m_Father.m_PathID]
for r in roots:
    t=tf[r]; print("ROOT",name(r))
    for c in t.m_Children:
        x=tf[c.m_PathID]; print("  child",name(c.m_PathID),v(x.m_LocalPosition),v(x.m_LocalRotation),v(x.m_LocalScale),"nchild",len(x.m_Children))
for pid,o in objs.items():
    if o.type.name=="SkinnedMeshRenderer":
        s=o.read(); go=s.m_GameObject.read()
        gt=[x for x in tf.values() if x.m_GameObject.m_PathID==s.m_GameObject.m_PathID][0]
        fp=path(gt.m_Father.m_PathID) if gt.m_Father and gt.m_Father.m_PathID else None
        bones=[b.m_PathID for b in s.m_Bones]
        missing=sum(1 for b in bones if b not in tf)
        print(go.m_Name[-14:], "| parent:",fp,"| pos",v(gt.m_LocalPosition),v(gt.m_LocalRotation),"| bones",len(bones),"missing",missing,"| b0:", path(bones[0])[-90:] if bones[0] in tf else bones[0])
