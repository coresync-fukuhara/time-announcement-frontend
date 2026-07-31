import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadDropzone } from '@/components/UploadDropzone';

function wavFile(name = 'chime.wav', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: 'audio/wav' });
}

describe('UploadDropzone', () => {
  it('既定のラベルを表示する', () => {
    render(<UploadDropzone uploading={false} onUpload={() => {}} onValidationError={() => {}} />);
    expect(screen.getByText('📁 .wav をドラッグ&ドロップ、またはクリックして追加')).toBeInTheDocument();
  });

  it('uploading=true のときは「アップロード中...」を表示し、非活性になる', () => {
    render(<UploadDropzone uploading onUpload={() => {}} onValidationError={() => {}} />);
    expect(screen.getByText('アップロード中...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '楽曲をアップロード' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('.wav ファイルを選択すると onUpload にそのファイルを渡す', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(<UploadDropzone uploading={false} onUpload={onUpload} onValidationError={() => {}} />);
    const input = screen.getByLabelText('ファイルを選択');
    const file = wavFile();
    await user.upload(input, file);
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('.wav 以外の拡張子は onValidationError を呼び、onUpload は呼ばない', async () => {
    // accept=".wav" によるブラウザ/testing-library側のファイルフィルタを無効化し、
    // コンポーネント自身の拡張子検証ロジックを実際に通過させる。
    const user = userEvent.setup({ applyAccept: false });
    const onUpload = vi.fn();
    const onValidationError = vi.fn();
    render(
      <UploadDropzone uploading={false} onUpload={onUpload} onValidationError={onValidationError} />,
    );
    const input = screen.getByLabelText('ファイルを選択');
    await user.upload(input, wavFile('chime.mp3'));
    expect(onValidationError).toHaveBeenCalledWith('.wav 形式のファイルのみアップロードできます。');
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('50MB超のファイルは onValidationError を呼ぶ', async () => {
    const user = userEvent.setup();
    const onValidationError = vi.fn();
    render(
      <UploadDropzone uploading={false} onUpload={() => {}} onValidationError={onValidationError} />,
    );
    const input = screen.getByLabelText('ファイルを選択');
    await user.upload(input, wavFile('big.wav', 50 * 1024 * 1024 + 1));
    expect(onValidationError).toHaveBeenCalledWith('ファイルサイズが大きすぎます(上限50MB)。');
  });

  it('複数ファイルを同時にドロップすると onValidationError を呼ぶ', () => {
    const onValidationError = vi.fn();
    const onUpload = vi.fn();
    render(
      <UploadDropzone uploading={false} onUpload={onUpload} onValidationError={onValidationError} />,
    );
    const zone = screen.getByRole('button', { name: '楽曲をアップロード' });
    fireEvent.drop(zone, { dataTransfer: { files: [wavFile('a.wav'), wavFile('b.wav')] } });
    expect(onValidationError).toHaveBeenCalledWith('一度に1つのファイルだけ選択してください。');
    expect(onUpload).not.toHaveBeenCalled();
  });
});
