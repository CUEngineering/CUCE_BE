import { bignumber, larger, largerEq } from 'mathjs';

export function processPaginationInputOpts(options: { perPage?: string | number; page?: string | number }) {
  let perPage = bignumber(options.perPage ?? 20).toNumber();
  if (larger(perPage, 100)) {
    perPage = 100;
  } else if (largerEq(0, perPage)) {
    perPage = 10;
  }

  let page = bignumber(options.page ?? 1).toNumber();
  if (largerEq(0, page)) {
    page = 1;
  }

  return {
    perPage,
    page,
    limit: perPage,
    offset: bignumber(page).minus(1).times(perPage).toNumber(),
  };
}
