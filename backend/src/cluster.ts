import cluster from 'cluster';
import os from 'os';

const numWorkers = parseInt(process.env.WEB_CONCURRENCY || String(os.cpus().length), 10);

if (cluster.isPrimary) {
  console.log(`🔀 Master ${process.pid} — démarrage de ${numWorkers} workers`);

  for (let i = 0; i < numWorkers; i++) cluster.fork();

  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} en ligne`);
  });

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`⚠️  Worker ${worker.process.pid} arrêté (${signal ?? code}) — redémarrage`);
    cluster.fork();
  });
} else {
  // Chaque worker charge l'app Express indépendamment
  require('./server');
}
