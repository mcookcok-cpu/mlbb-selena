import UnityPy, numpy as np
B="/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/"
env = UnityPy.load(B+"h/hero_selena_skin_high_add.unity3d")
for o in env.objects:
    if o.type.name=="Texture2D":
        d=o.read()
        try:
            im=d.image; a=np.asarray(im.convert("RGBA")).reshape(-1,4)
            st=" ".join(f"{a[:,i].mean():.0f}/{a[:,i].min()}-{a[:,i].max()}" for i in range(4))
        except Exception as e: st="ERR "+str(e)[:50]; im=None
        print("TEX",d.m_Name,d.m_Width,d.m_Height,str(d.m_TextureFormat).split('.')[-1],"| RGBA mean/min-max:",st)
print("---- hierarchy")
gos={}
tr={}
for o in env.objects:
    if o.type.name=="Transform":
        t=o.read(); tr[o.path_id]=t
roots=[pid for pid,t in tr.items() if not t.m_Father or not t.m_Father.m_PathID]
for r in roots:
    t=tr[r]; g=t.m_GameObject.read(); print("ROOT",g.m_Name,t.m_LocalPosition,t.m_LocalRotation,t.m_LocalScale,"children",len(t.m_Children))
for o in env.objects:
    if o.type.name=="Animation":
        d=o.read(); g=d.m_GameObject.read(); print("ANIM on",g.m_Name,[c.read().m_Name for c in d.m_Animations], d.m_Animation.read().m_Name if d.m_Animation and d.m_Animation.m_PathID else None)
    if o.type.name=="AnimationClip":
        d=o.read()
        rc=d.m_RotationCurves[0]
        print("CLIPDETAIL",d.m_Name,"path0",rc.path,"keys",len(rc.curve.m_Curve),"t_end",rc.curve.m_Curve[-1].time, "k0", rc.curve.m_Curve[0].time, rc.curve.m_Curve[0].value, rc.curve.m_Curve[0].inSlope)
        fc=d.m_FloatCurves[:3]
        print("   float sample",[(f.path,f.attribute,f.classID) for f in fc], "wrap",d.m_WrapMode)
