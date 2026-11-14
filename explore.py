import UnityPy, sys
B="/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/"
env = UnityPy.load(B+"h/hero_selena_skin_high_add.unity3d")
for o in env.objects:
    if o.type.name in ("Mesh","Material","AnimationClip","SkinnedMeshRenderer","Animation"):
        d = o.read()
        if o.type.name=="Mesh":
            print("MESH", d.m_Name, "verts", d.m_VertexCount, "subs", len(d.m_SubMeshes), "bones", len(d.m_BindPose), "chan", d.m_VertexData.m_Channels is not None)
        elif o.type.name=="Material":
            try:
                tex = {k:(v.m_Texture.read().m_Name if v.m_Texture and v.m_Texture.m_PathID else None) for k,v in d.m_SavedProperties.m_TexEnvs.items()}
            except Exception as e: tex=str(e)
            print("MAT", d.m_Name, "-", tex)
        elif o.type.name=="AnimationClip":
            print("CLIP", d.m_Name, "len", getattr(d,'m_Legacy',None), "rot", len(d.m_RotationCurves) if hasattr(d,'m_RotationCurves') else None, "pos", len(d.m_PositionCurves) if hasattr(d,'m_PositionCurves') else None, "scale", len(d.m_ScaleCurves) if hasattr(d,'m_ScaleCurves') else None, "float", len(d.m_FloatCurves) if hasattr(d,'m_FloatCurves') else None, "sr", d.m_SampleRate)
        elif o.type.name=="SkinnedMeshRenderer":
            print("SMR", d.m_GameObject.read().m_Name, "mesh", d.m_Mesh.read().m_Name if d.m_Mesh else None, "bones", len(d.m_Bones), "mats", [m.read().m_Name for m in d.m_Materials])
for o in env.objects:
    if o.type.name=="Texture2D":
        d=o.read(); print("TEX", d.m_Name, d.m_Width, d.m_Height, d.m_TextureFormat)
