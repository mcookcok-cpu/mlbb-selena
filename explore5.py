import UnityPy, numpy as np
from UnityPy.helpers.MeshHelper import MeshHandler
B="/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/"
env = UnityPy.load(B+"h/hero_selena_skin_high_add.unity3d")
done=set()
for o in env.objects:
    if o.type.name=="Mesh":
        d=o.read()
        h=MeshHandler(d); h.process()
        if d.m_Name.endswith("face01"):
            print("HANDLER attrs",[a for a in dir(h) if not a.startswith('_')])
            for a in ("m_Vertices","m_Normals","m_Tangents","m_UV0","m_UV1","m_Colors","m_BoneWeights","m_BoneIndices","m_Indices","m_SubMeshes"):
                v=getattr(h,a,None)
                print(a, type(v).__name__, (len(v) if v is not None else None), (v[0] if v is not None and len(v)>0 else None))
            bp=d.m_BindPose[0]; print("BINDPOSE type",type(bp).__name__, [a for a in dir(bp) if not a.startswith('_')][:30])
            print(bp)
            sh=d.m_Shapes
            print("SHAPES type",type(sh).__name__,[a for a in dir(sh) if not a.startswith('_')])
            print("nverts",len(sh.vertices),"nshapes",len(sh.shapes),"nchan",len(sh.channels),"fw",len(sh.fullWeights))
            print("chan0",sh.channels[0].name, sh.channels[0].frameIndex, sh.channels[0].frameCount)
            print("shape0",vars(sh.shapes[0]) if hasattr(sh.shapes[0],'__dict__') else sh.shapes[0])
            print("vert0",sh.vertices[0], [a for a in dir(sh.vertices[0]) if not a.startswith('_')])
            print([c.name for c in sh.channels])
        if d.m_Name.endswith("body01"):
            print("body01 shapes", len(d.m_Shapes.channels) if d.m_Shapes else None)
            print("submesh", d.m_SubMeshes[0].firstByte, d.m_SubMeshes[0].indexCount, d.m_SubMeshes[0].topology)
