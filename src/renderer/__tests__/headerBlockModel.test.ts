import { describe, expect, it } from 'vitest';
import type { HeaderBlock } from '../shared/types/layouts';
import { headerBlockStyles } from '../pages/invoices/Preview/models/headerBlockModel';

describe('headerBlockStyles', () => {
  it('keeps a bare column without layout styles', () => {
    const styles = headerBlockStyles({ type: 'column' } as HeaderBlock);

    expect(styles).toEqual([]);
  });

  it('maps align, justify, width and spacing onto styles', () => {
    const styles = headerBlockStyles({
      type: 'row',
      align: 'center',
      justify: 'between',
      width: '50%',
      paddingTop: 10,
      paddingBottom: 20,
      gap: 10
    } as HeaderBlock);

    expect(styles).toContainEqual({ alignItems: 'center' });
    expect(styles).toContainEqual({ justifyContent: 'space-between' });
    expect(styles).toContainEqual({ width: '50%' });
    expect(styles).toContainEqual({ paddingTop: 10 });
    expect(styles).toContainEqual({ paddingBottom: 20 });
    expect(styles).toContainEqual({ gap: 10 });
  });

  it('supports start and end alignment plus the 20 padding step', () => {
    expect(headerBlockStyles({ type: 'row', align: 'start' } as HeaderBlock)).toContainEqual({
      alignItems: 'flex-start'
    });
    expect(headerBlockStyles({ type: 'row', align: 'end' } as HeaderBlock)).toContainEqual({
      alignItems: 'flex-end'
    });
    expect(headerBlockStyles({ type: 'row', paddingTop: 20 } as HeaderBlock)).toContainEqual({ paddingTop: 20 });
    expect(headerBlockStyles({ type: 'row', gap: 5 } as HeaderBlock)).toContainEqual({ gap: 5 });
    expect(headerBlockStyles({ type: 'row', width: '100%' } as HeaderBlock)).toContainEqual({ width: '100%' });
  });

  it('adds the boxed background style', () => {
    const styles = headerBlockStyles({ type: 'column', boxed: true } as HeaderBlock);

    expect(styles).toContainEqual({ backgroundColor: '#e6dfd8', padding: 5, borderRadius: 5 });
  });

  it('applies row styles to row blocks only', () => {
    expect(headerBlockStyles({ type: 'row' } as HeaderBlock)).toContainEqual({ flexDirection: 'row' });
    expect(headerBlockStyles({ type: 'column' } as HeaderBlock)).not.toContainEqual({ flexDirection: 'row' });
  });
});
