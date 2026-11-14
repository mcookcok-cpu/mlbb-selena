import UnityPy, numpy as np
from PIL import Image, ImageDraw
from UnityPy.helpers.MeshHelper import MeshHandler
B="/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/"
env = UnityPy.load(B+"h/hero_selena_skin_high_add.unity3d")
meshes={}; texs={}; mats={}; smr={}
for o in env.objects:
    t=o.type.name
    if t=="Mesh": d=o.read(); h=MeshHandler(d); h.process(); meshes[d.m_Name]=(d,h)
    elif t=="Texture2D": d=o.read(); texs[d.m_Name]=d
    elif t=="Material": d=o.read(); mats[d.m_Name]=d
def cover(mname, S=256):
    d,h=meshes[mname]; tris=h.get_triangles()
    im=Image.new("L",(S,S),0); dr=ImageDraw.Draw(im)
    uv=h.m_UV0
    for sub in tris:
        for tri in sub:
            pts=[(uv[k][0]*S,(1-uv[k][1])*S) for k in tri]
            dr.polygon(pts,fill=255)
    return np.asarray(im)>0
def stats(mname,tname):
    c=cover(mname); T=texs[tname]; a=np.asarray(T.image.convert("RGBA").resize((256,256))).astype(float)
    cov=c.mean()
    out=[]
    for i,ch in enumerate("RGBA"):
        ins=a[...,i][c].mean() if c.any() else -1; outs=a[...,i][~c].mean() if (~c).any() else -1
        out.append(f"{ch}:in{ins:.0f}/out{outs:.0f}")
    print(f"{mname[-12:]:>12} x {tname[-28:]:<28} cov={cov:.2f}  "+"  ".join(out))
pairs=[("63_selena_skin10_high_hair01","63_selena_skin10_high_hair01_hairmask"),("63_selena_skin10_high_hair01","63_selena_skin10_high_hair01_d"),("63_selena_skin10_high_hair01","63_selena_skin10_high_hair01_e"),("63_selena_skin10_high_hair01","63_selena_skin10_high_hair01_hairmap"),
("63_selena_skin10_high_hair02","63_selena_skin10_high_hair02_d"),("63_selena_skin10_high_hair02","63_selena_skin10_high_hair02_m"),
("63_selena_skin10_high_body02","63_selena_skin10_high_body02_d"),("63_selena_skin10_high_body02","63_selena_skin10_high_body02_e"),("63_selena_skin10_high_body02","63_selena_skin10_high_body02_m"),("63_selena_skin10_high_body02","63_selena_skin10_high_body02_m02"),
("63_selena_skin10_high_body01","63_selena_skin10_high_body01_d"),("63_selena_skin10_high_body01","63_selena_skin10_high_body01_e"),("63_selena_skin10_high_body01","63_selena_skin10_high_body01_m"),("63_selena_skin10_high_body01","63_selena_skin10_high_body01_emissive"),("63_selena_skin10_high_body01","63_selena_skin10_high_body01_Bling"),
("63_selena_skin10_high_qunzi01","63_selena_skin10_high_qunzi01_d"),("63_selena_skin10_high_qunzi01","63_selena_skin10_high_qunzi01_m"),
("63_selena_skin10_high_face01","63_selena_skin10_high_face01_d"),("63_selena_skin10_high_face01","63_selena_skin10_high_face01_e"),("63_selena_skin10_high_face01","63_selena_skin10_high_face01_m"),("63_selena_skin10_high_face02","63_selena_skin10_high_body02_d"),
]
for m,t in pairs: stats(m,t)
# bounds
for n,(d,h) in meshes.items():
    v=np.array(h.m_Vertices); print(n[-8:],"bbox",v.min(0).round(2),v.max(0).round(2),"tris",sum(len(s) for s in h.get_triangles()))
