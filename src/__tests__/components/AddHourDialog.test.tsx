import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddHourDialog } from '@/components/AddHourDialog';

describe('AddHourDialog', () => {
  it('open=false のときは何も表示しない', () => {
    render(<AddHourDialog open={false} usedHours={[]} onAdd={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('使用済みの時間は選択できない', () => {
    render(<AddHourDialog open usedHours={[9]} onAdd={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: '9時' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '10時' })).toBeEnabled();
  });

  it('複数選択して追加すると onAdd に選んだ時間の配列を渡す', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddHourDialog open usedHours={[]} onAdd={onAdd} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: '10時' }));
    await user.click(screen.getByRole('button', { name: '17時' }));
    await user.click(screen.getByRole('button', { name: '追加する' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const added = onAdd.mock.calls[0][0] as number[];
    expect(added.slice().sort((a, b) => a - b)).toEqual([10, 17]);
  });

  it('何も選ばないうちは「追加する」が非活性', () => {
    render(<AddHourDialog open usedHours={[]} onAdd={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: '追加する' })).toBeDisabled();
  });

  it('キャンセルで onClose を呼ぶ', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddHourDialog open usedHours={[]} onAdd={() => {}} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalled();
  });
});
