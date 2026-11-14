import UnityPy
B="/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/"
env = UnityPy.load(B+"h/hero_selena_skin_high_add.unity3d")
seen=set()
for o in env.objects:
    t=o.type.name
    if t in ("Mesh","AnimationClip","Material","Texture2D","SkinnedMeshRenderer","Animation","Transform") and t not in seen:
        seen.add(t)
        d=o.read()
        print("==",t, [a for a in dir(d) if not a.startswith('_')][:80])
