#!/usr/bin/env node
import { createServer, build } from 'vite';

const command = process.argv[2] || 'dev';

if (command === 'build') {
  await build();
} else if (command === 'preview') {
  const server = await createServer({
    preview: true
  });
  await server.listen();
  server.printUrls();
} else {
  const server = await createServer();
  await server.listen();
  server.printUrls();
}
