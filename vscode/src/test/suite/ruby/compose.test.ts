import assert from "assert";
import path from "path";
import fs from "fs";
import os from "os";

import * as vscode from "vscode";
import sinon from "sinon";

import { WorkspaceChannel } from "../../../workspaceChannel";
import { Compose } from "../../../ruby/compose";
import * as common from "../../../common";
import { ACTIVATION_SEPARATOR } from "../../../ruby/versionManager";
import { createSpawnStub } from "../testHelpers";

suite("Compose", () => {
  let spawnStub: sinon.SinonStub;
  let configStub: sinon.SinonStub;
  let stdinData: string[];

  teardown(() => {
    spawnStub?.restore();
    configStub?.restore();
  });

  test("Activates Ruby environment using Docker Compose", async () => {
    const workspacePath = fs.mkdtempSync(
      path.join(os.tmpdir(), "ruby-lsp-test-"),
    );
    const uri = vscode.Uri.file(workspacePath);
    const workspaceFolder = {
      uri,
      name: path.basename(workspacePath),
      index: 0,
    };
    const outputChannel = new WorkspaceChannel("fake", common.LOG_CHANNEL);
    const compose = new Compose(workspaceFolder, outputChannel, async () => {});
    const composeService = "develop";

    const envStub = {
      env: { ANY: "true" },
      yjit: true,
      version: "3.0.0",
    };

    ({ spawnStub, stdinData } = createSpawnStub({
      stderr: `${ACTIVATION_SEPARATOR}${JSON.stringify(envStub)}${ACTIVATION_SEPARATOR}`,
    }));

    configStub = sinon.stub(vscode.workspace, "getConfiguration").returns({
      get: (name: string) => {
        if (name === "composeService") {
          return composeService;
        }
        return undefined;
      },
    } as any);

    const { version, yjit } = await compose.activate();

    // We must not set the shell on Windows
    const shell = os.platform() === "win32" ? undefined : vscode.env.shell;

    assert.ok(
      spawnStub.calledOnceWithExactly(
        "docker",
        [
          "--log-level=error",
          "compose",
          "--progress=quiet",
          "run",
          "--rm",
          "-i",
          composeService,
          "ruby",
          "-W0",
          "-rjson",
        ],
        {
          cwd: uri.fsPath,
          shell,
          // eslint-disable-next-line no-process-env
          env: process.env,
        },
      ),
    );

    assert.ok(stdinData.join("\n").includes(compose.activationScript));

    assert.strictEqual(version, "3.0.0");
    assert.strictEqual(yjit, true);

    fs.rmSync(workspacePath, { recursive: true, force: true });
  });
});
