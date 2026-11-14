import UnityPy, numpy as np
from PIL import Image, ImageDraw
from UnityPy.helpers.MeshHelper import MeshHandler
B="/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/"
env=UnityPy.load(B+"h/hero_selena_skin_high_add.unity3d")
meshes={};texs={}
for o in env.objects:
    if o.type.name=="Mesh": d=o.read(); h=MeshHandler(d); h.process(); meshes[d.m_Name.split("high_")[-1]]=h
    elif o.type.name=="Texture2D": d=o.read(); texs[d.m_Name.split("high_")[-1]]=d.image.convert("RGBA")
def cover(h,flip,S=256):
    im=Image.new("L",(S,S),0); dr=ImageDraw.Draw(im); uv=h.m_UV0
    for sub in h.get_triangles():
        for tri in sub:
            dr.polygon([(uv[k][0]*S,((1-uv[k][1]) if flip else uv[k][1])*S) for k in tri],fill=255)
    return np.asarray(im)>0
tests=[("body01","body01_d"),("body01","body01_m"),("body01","body01_n"),("body02","body02_d"),("body02","body02_m02"),("body02","body02_e"),("face01","face01_d"),("face01","face01_m"),("qunzi01","qunzi01_d"),("qunzi01","qunzi01_n"),("hair01","hair01_d"),("hair01","hair01_hairmask"),("hair02","hair02_d")]
for m,t in tests:
    a=np.asarray(texs[t].resize((256,256))).astype(float)
    feat=np.abs(a[...,:3]-np.median(a[...,:3].reshape(-1,3),0)).sum(2)  # deviation from typical colour
    res=[]
    for flip in (True,False):
        c=cover(meshes[m],flip)
        res.append((feat[c].mean()-feat[~c].mean()) if (~c).any() else 0)
    # also inside-coverage fraction of 'non-black-ish' pixels
    print(f"{m:8}{t:18} cover(1-v)={cover(meshes[m],True).mean():.2f}  contrast flip(1-v)={res[0]:7.1f}  noflip(v)={res[1]:7.1f}  -> {'1-v OK' if res[0]>res[1] else 'v?'}")
