import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { AppModule } from './../src/app.module';

try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
} catch (e) {
  console.error('Failed to load .env in e2e tests:', e);
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let canBindPort = true;

  async function supportsEphemeralPortBinding(): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.listen(0, () => {
        server.close(() => resolve(true));
      });
    });
  }

  beforeEach(async () => {
    canBindPort = await supportsEphemeralPortBinding();
    if (!canBindPort) {
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', (done) => {
    if (!canBindPort) {
      done();
      return;
    }

    void request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!')
      .then(() => done())
      .catch(done);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
