import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Injectable } from '@nestjs/common';

import { loadEnvironment } from '../../../common/config/environment.js';
import {
  PermanentProcessingError,
  type PdfProcessor,
  type ProcessedPdf,
} from '../application/pdf-processor.js';

interface CommandResult {
  stderr: string;
  stdout: string;
}

@Injectable()
export class LinuxPdfProcessor implements PdfProcessor {
  private readonly timeout = loadEnvironment().jobTimeoutMs;

  public async process(originalPdf: Buffer, password: string): Promise<ProcessedPdf> {
    const workingDirectory = await mkdtemp(path.join(tmpdir(), 'mediagnostics-worker-'));
    const inputPath = path.join(workingDirectory, 'original.pdf');
    const protectedPath = path.join(workingDirectory, 'protected.pdf');
    const previewBasePath = path.join(workingDirectory, 'preview');
    const previewPngPath = `${previewBasePath}.png`;
    const previewWebpPath = path.join(workingDirectory, 'preview.webp');

    try {
      await writeFile(inputPath, originalPdf, { mode: 0o600 });
      await this.validatePdf(inputPath);
      const pageCount = await this.readPageCount(inputPath);
      await this.run('pdftoppm', [
        '-f',
        '1',
        '-singlefile',
        '-png',
        '-r',
        '120',
        inputPath,
        previewBasePath,
      ]);
      await this.run('cwebp', ['-quiet', '-q', '80', previewPngPath, '-o', previewWebpPath]);

      const ownerPassword = randomBytes(24).toString('base64url');
      await this.run('qpdf', [
        '--encrypt',
        password,
        ownerPassword,
        '256',
        '--print=full',
        '--modify=none',
        '--extract=n',
        '--',
        inputPath,
        protectedPath,
      ]);

      return {
        pageCount,
        preview: await readFile(previewWebpPath),
        protectedPdf: await readFile(protectedPath),
        sha256: createHash('sha256').update(originalPdf).digest('hex'),
      };
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  }

  private async validatePdf(inputPath: string): Promise<void> {
    try {
      await this.run('qpdf', ['--check', inputPath]);
    } catch (error: unknown) {
      if (this.isCommandMissing(error)) throw error;
      throw new PermanentProcessingError('PDF_DAMAGED', 'The PDF is damaged or malformed.');
    }

    const encryption = await this.run('qpdf', ['--show-encryption', inputPath]);
    if (!encryption.stdout.includes('File is not encrypted')) {
      throw new PermanentProcessingError(
        'PDF_ALREADY_ENCRYPTED',
        'Encrypted PDF files are not accepted.',
      );
    }

    const structure = await this.run('qpdf', ['--json', inputPath]);
    if (/\/(?:AA|EmbeddedFile|JavaScript|JS|Launch|OpenAction)\b/.test(structure.stdout)) {
      throw new PermanentProcessingError(
        'PDF_ACTIVE_CONTENT',
        'PDF files with active or embedded content are not accepted.',
      );
    }
  }

  private async readPageCount(inputPath: string): Promise<number> {
    const information = await this.run('pdfinfo', [inputPath]);
    const match = /^Pages:\s+(\d+)$/m.exec(information.stdout);
    const pageCount = match?.[1] === undefined ? Number.NaN : Number(match[1]);
    if (!Number.isSafeInteger(pageCount) || pageCount <= 0) {
      throw new PermanentProcessingError(
        'PDF_NO_PAGES',
        'The PDF does not contain readable pages.',
      );
    }
    return pageCount;
  }

  private run(command: string, arguments_: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      execFile(
        command,
        arguments_,
        { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: this.timeout },
        (error, stdout, stderr) => {
          if (error !== null) {
            reject(error instanceof Error ? error : new Error(`${command} failed.`));
            return;
          }
          resolve({ stderr, stdout });
        },
      );
    });
  }

  private isCommandMissing(error: unknown): boolean {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
  }
}
