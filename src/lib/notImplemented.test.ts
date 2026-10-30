import { notImplemented } from './notImplemented';

it('stub ném lỗi có mã task để owner tìm được', () => {
  expect(() => notImplemented('DATA-01')).toThrow('NOT_IMPLEMENTED: DATA-01');
});
