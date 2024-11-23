/* eslint-disable no-process-env */
import { ExecOptions } from "child_process";
import path from "path";

import * as vscode from "vscode";
import { Executable } from "vscode-languageclient/node";

import { ContainerPathConverter, fetchPathMapping } from "../docker";

import { VersionManager, ActivationResult } from "./versionManager";

// Compose
//
// Compose Ruby environment activation can be used for all cases where an existing version manager does not suffice.
// Users are allowed to define a shell script that runs before calling ruby, giving them the chance to modify the PATH,
// GEM_HOME and GEM_PATH as needed to find the correct Ruby runtime.
export class Compose extends VersionManager {
  async activate(): Promise<ActivationResult> {
    const parsedResult = await this.runEnvActivationScript(
      `${this.composeRunCommand()} ${this.composeServiceName()} ruby`,
    );

    return {
      env: { ...process.env },
      yjit: parsedResult.yjit,
      version: parsedResult.version,
      gemPath: parsedResult.gemPath,
    };
  }

  runActivatedScript(command: string, options: ExecOptions = {}) {
    return this.runScript(
      `${this.composeRunCommand()} ${this.composeServiceName()} ${command}`,
      options,
    );
  }

  activateExecutable(executable: Executable) {
    const composeCommand = this.parseCommand(
      `${this.composeRunCommand()} ${this.composeServiceName()}`,
    );

    return {
      command: composeCommand.command,
      args: [
        ...composeCommand.args,
        executable.command,
        ...(executable.args || []),
      ],
      options: {
        ...executable.options,
        env: { ...(executable.options?.env || {}), ...composeCommand.env },
      },
    };
  }

  async buildPathConverter(workspaceFolder: vscode.WorkspaceFolder) {
    const configJson = await this.runScript(
      `${this.composeCommand()} config --format=json`,
    );
    const config = JSON.parse(configJson.stdout);
    const pathMapping = fetchPathMapping(config, this.composeServiceName());

    const stats = Object.entries(pathMapping).map(([local, remote]) => {
      const absolute = path.resolve(workspaceFolder.uri.fsPath, local);
      return vscode.workspace.fs.stat(vscode.Uri.file(absolute)).then(
        (stat) => ({ stat, local, remote, absolute }),
        () => ({ stat: undefined, local, remote, absolute }),
      );
    });

    const filteredMapping = (await Promise.all(stats)).reduce(
      (acc, { stat, local, remote, absolute }) => {
        if (stat?.type === vscode.FileType.Directory) {
          this.outputChannel.info(`Path ${absolute} mapped to ${remote}`);
          acc[absolute] = remote;
        } else {
          this.outputChannel.debug(
            `Skipping path ${local} because it does not exist`,
          );
        }

        return acc;
      },
      {} as Record<string, string>,
    );

    return new ContainerPathConverter(filteredMapping, this.outputChannel);
  }

  protected composeRunCommand(): string {
    return `${this.composeCommand()} run --rm -i --no-deps`;
  }

  protected composeServiceName(): string {
    const service: string | undefined = vscode.workspace
      .getConfiguration("rubyLsp.rubyVersionManager")
      .get("composeService");

    if (service === undefined) {
      throw new Error(
        "The composeService configuration must be set when 'compose' is selected as the version manager. \
        See the [README](https://shopify.github.io/ruby-lsp/version-managers.html) for instructions.",
      );
    }

    return service;
  }

  protected composeCommand(): string {
    const composeCustomCommand: string | undefined = vscode.workspace
      .getConfiguration("rubyLsp.rubyVersionManager")
      .get("composeCustomCommand");

    return (
      composeCustomCommand ||
      "docker --log-level=error compose --progress=quiet"
    );
  }
}
