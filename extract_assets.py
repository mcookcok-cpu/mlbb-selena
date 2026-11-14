import UnityPy, os, json, re, subprocess, hashlib, glob, sys
from PIL import Image
ROOT = "/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/"
OUT = "/home/agentuser/mlbb-selena/public/assets"
VG = "/home/agentuser/mlbb-selena/tools/vgmstream-cli"
for d in ("tex", "thumbs", "mesh", "audio"): os.makedirs(f"{OUT}/{d}", exist_ok=True)
GROUPS = {"h": "Model hero", "e": "Efek evilgirl (city action)", "t": "Efek TeamColor", "s": "Efek skill (dasar)", "zzp1_s": "Efek skill skin10 (zzp1)",
          "zzp1_t": "Efek TeamColor skin10", "zzp2_s": "Efek skill skin10 (zzp2)", "zzp2_h": "Efek hero skin10 (kamera/aura)", "UI": "UI & ikon"}
def group_of(path):
    parts = path.replace(ROOT, "").split("/")
    return GROUPS.get(parts[2] if parts[0] == "Art" else parts[0], parts[0]) if len(parts) > 2 else parts[0]
def safe(n): return re.sub(r"[^\w.\-]+", "_", n)[:90]
def thumb(img, key):
    im = img.copy(); im.thumbnail((200, 200))
    bg = Image.new("RGB", im.size, (40, 40, 48))
    if im.mode == "RGBA": bg.paste(im, mask=im.split()[3])
    else: bg.paste(im.convert("RGB"))
    p = f"thumbs/{key}.jpg"; bg.save(f"{OUT}/{p}", "JPEG", quality=78); return p

inv = {"bundles": [], "audio": []}
seen_tex = {}
files = sorted(glob.glob(ROOT + "Art/**/*.unity3d", recursive=True) + glob.glob(ROOT + "UI/**/*.unity3d", recursive=True))
print("bundles:", len(files), flush=True)
for fi, f in enumerate(files):
    short = os.path.basename(f).replace(".unity3d", "")
    entry = {"name": short, "group": group_of(f), "size": os.path.getsize(f), "types": {}, "textures": [], "sprites": [], "meshes": []}
    try: env = UnityPy.load(f)
    except Exception as e:
        print("ERR load", short, e, flush=True); continue
    for o in env.objects:
        t = o.type.name; entry["types"][t] = entry["types"].get(t, 0) + 1
        try:
            if t == "Texture2D":
                d = o.read(); img = d.image
                key = hashlib.md5((short + d.m_Name).encode()).hexdigest()[:12]
                rel = f"tex/{safe(short)}/{safe(d.m_Name)}.png"
                os.makedirs(f"{OUT}/tex/{safe(short)}", exist_ok=True)
                if not os.path.exists(f"{OUT}/{rel}"): img.save(f"{OUT}/{rel}")
                entry["textures"].append({"name": d.m_Name, "w": d.m_Width, "h": d.m_Height, "path": rel, "thumb": thumb(img, key)})
            elif t == "Sprite":
                d = o.read(); img = d.image
                key = hashlib.md5((short + "sp" + d.m_Name).encode()).hexdigest()[:12]
                rel = f"tex/{safe(short)}/sprite_{safe(d.m_Name)}.png"
                os.makedirs(f"{OUT}/tex/{safe(short)}", exist_ok=True)
                if not os.path.exists(f"{OUT}/{rel}"): img.save(f"{OUT}/{rel}")
                entry["sprites"].append({"name": d.m_Name, "w": img.width, "h": img.height, "path": rel, "thumb": thumb(img, key)})
            elif t == "Mesh" and not short.startswith("hero_selena_skin_high"):
                d = o.read(); obj = d.export()
                if obj and len(obj) > 50:
                    rel = f"mesh/{safe(short)}__{safe(d.m_Name)}.obj"
                    open(f"{OUT}/{rel}", "w").write(obj)
                    entry["meshes"].append({"name": d.m_Name, "path": rel})
        except Exception as e:
            entry.setdefault("errors", []).append(f"{t}: {str(e)[:60]}")
    inv["bundles"].append(entry)
    print(f"[{fi+1}/{len(files)}] {short[:50]:<50} tex={len(entry['textures'])} spr={len(entry['sprites'])} mesh={len(entry['meshes'])}", flush=True)

# audio
for bnk in sorted(glob.glob(ROOT + "Audio/**/*.bnk", recursive=True)):
    base = os.path.basename(bnk).split(".")[0]
    d = f"{OUT}/audio/{base}"; os.makedirs(d, exist_ok=True)
    r = subprocess.run([VG, "-S", "0", "-o", f"{d}/?s.wav", bnk], capture_output=True, text=True, timeout=300)
    wavs = sorted(glob.glob(d + "/*.wav"))
    print("audio", base, len(wavs), flush=True)
    for w in wavs:
        ogg = w[:-4] + ".ogg"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", w, "-c:a", "libvorbis", "-q:a", "4", ogg])
        try:
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ogg], capture_output=True, text=True).stdout.strip() or 0)
        except Exception: dur = 0
        os.remove(w)
        inv["audio"].append({"bank": base, "id": os.path.basename(ogg)[:-4], "path": f"audio/{base}/{os.path.basename(ogg)}", "dur": round(dur, 2)})
json.dump(inv, open(f"{OUT}/inventory.json", "w"), ensure_ascii=False)
print("DONE", len(inv["bundles"]), "bundles", len(inv["audio"]), "audio", flush=True)
