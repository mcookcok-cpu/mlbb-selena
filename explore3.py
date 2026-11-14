import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler
B="/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/"
for fn in ["h/hero_selena_skin_high_add.unity3d","h/hero_selena_skin.unity3d"]:
    print("#####",fn)
    env = UnityPy.load(B+fn)
    for o in env.objects:
        t=o.type.name
        d=o.read()
        if t=="AnimationClip":
            print("CLIP",d.m_Name,"legacy",d.m_Legacy,"type",d.m_AnimationType,"rot",len(d.m_RotationCurves),"eul",len(d.m_EulerCurves),"pos",len(d.m_PositionCurves),"scl",len(d.m_ScaleCurves),"float",len(d.m_FloatCurves),"comp",d.m_Compressed,"crot",len(d.m_CompressedRotationCurves),"sr",d.m_SampleRate,"muscle", d.m_MuscleClip is not None)
        elif t=="Mesh":
            h=MeshHandler(d); h.process()
            print("MESH",d.m_Name,"v",len(h.m_Vertices) if h.m_Vertices is not None else None,"subs",len(d.m_SubMeshes),"bind",len(d.m_BindPose),"skin", len(h.m_BoneWeights) if getattr(h,'m_BoneWeights',None) is not None else None, "uv", getattr(h,'m_UV0',None) is not None)
        elif t=="SkinnedMeshRenderer":
            print("SMR",d.m_GameObject.read().m_Name,"->",d.m_Mesh.read().m_Name,"bones",len(d.m_Bones),"mats",[m.read().m_Name for m in d.m_Materials])
        elif t=="Material":
            sp=d.m_SavedProperties
            print("MAT",d.m_Name,[ (k, (v.m_Texture.read().m_Name if v.m_Texture.m_PathID else None)) for k,v in (sp.m_TexEnvs if isinstance(sp.m_TexEnvs,list) else sp.m_TexEnvs.items())] )
        elif t=="Texture2D":
            print("TEX",d.m_Name,d.m_Width,d.m_Height,d.m_TextureFormat)
