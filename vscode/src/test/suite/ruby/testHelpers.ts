import { EventEmitter, Readable, Writable } from "stream";
import { SpawnOptions } from "child_process";

import sinon from "sinon";

interface SpawnStubOptions {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export function createSpawnStub({
  stdout = "",
  stderr = "",
  exitCode = 0,
}: SpawnStubOptions = {}): sinon.SinonStub {
  const spawnStub = sinon
    .stub()
    .callsFake((_command: string, _args: string[], _options: SpawnOptions) => {
      const childProcess = new EventEmitter() as any;

      childProcess.stdout = new Readable({
        read() {
          this.push(stdout);
          this.push(null);
        },
      });
      childProcess.stderr = new Readable({
        read() {
          this.push(stderr);
          this.push(null);
        },
      });
      childProcess.stdin = new Writable({
        write(_chunk, _encoding, callback) {
          // You can add custom behavior here if needed
          childProcess.stdout.emit("data", stdout);
          childProcess.stderr.emit("data", stderr);

          callback();
        },
      });

      // Ensure events are emitted in next tick to simulate async behavior
      process.nextTick(() => {
        childProcess.emit("close", exitCode);
      });

      return childProcess;
    });

  return spawnStub;
}
