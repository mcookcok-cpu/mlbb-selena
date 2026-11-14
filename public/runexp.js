// EKSPERIMENTAL: klip lari ASLI dari file game (run, fastrun), diretarget ke rig HD oleh retarget_run_exp.py.
// Data: /models/run_exp_hd.json (rotasi lokal per node HD + posisi COM). Klip prosedural (locomotion.js) tetap ada sebagai cadangan.
export async function loadOriginalRunClips(THREE, root, url = '/models/run_exp_hd.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  const data = await res.json();
  const san = n => THREE.PropertyBinding.sanitizeNodeName(n);
  const clips = [];
  for (const c of data.clips) {
    const tracks = [];
    for (const t of c.tracks) {
      const node = root.getObjectByName(san(t.node));
      if (!node) continue;
      if (t.path === 'position') tracks.push(new THREE.VectorKeyframeTrack(`${node.name}.position`, c.times, t.values));
      else tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, c.times, t.values));
    }
    if (!tracks.length) continue;
    // frame terakhir ~ frame pertama (loop mulus), jadi durasi = waktu kunci terakhir
    clips.push(new THREE.AnimationClip('orig_' + c.name, c.times[c.times.length - 1], tracks));
  }
  return clips;
}
