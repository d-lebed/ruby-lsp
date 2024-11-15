/* eslint-disable no-process-env */
import { ExecOptions } from "child_process";

import * as vscode from "vscode";
import { Executable } from "vscode-languageclient/node";

import { VersionManager, ActivationResult } from "./versionManager";

// Compose
//
// Compose Ruby environment activation can be used for all cases where an existing version manager does not suffice.
// Users are allowed to define a shell script that runs before calling ruby, giving them the chance to modify the PATH,
// GEM_HOME and GEM_PATH as needed to find the correct Ruby runtime.
export class Compose extends VersionManager {
  async activate(): Promise<ActivationResult> {
    const parsedResult = await this.runEnvActivationScript("ruby");

    return {
      env: { ...process.env },
      yjit: parsedResult.yjit,
      version: parsedResult.version,
      gemPath: parsedResult.gemPath,
    };
  }

  runActivatedScript(command: string, options: ExecOptions = {}) {
    const escapedCommand = this.escapeForShell(command);

    return this.runScript(
      `${this.composeRunCommand()} ${escapedCommand}`,
      options,
    );
  }

  buildExecutable(command: string[]): Executable {
    const escapedCommand = this.escapeForShell(command.join(" "));
    const composePatrs = this.composeRunCommand().split(" ");

    return {
      command: composePatrs[0],
      args: [...composePatrs.slice(1), escapedCommand],
    };
  }

  protected composeRunCommand() {
    const configuration = vscode.workspace.getConfiguration(
      "rubyLsp.rubyVersionManager",
    );
    const composeRunCommand: string | undefined = configuration.get(
      "composeCustomCommand",
    );

    if (composeRunCommand === undefined) {
      throw new Error(
        "The customRubyCommand configuration must be set when 'custom' is selected as the version manager. \
        See the [README](https://shopify.github.io/ruby-lsp/version-managers.html) for instructions.",
      );
    }

    return composeRunCommand;
  }

  protected escapeForShell(command: string): string {
    return `'${command.replace(/'/g, "'\\''")}'`;
  }
}
