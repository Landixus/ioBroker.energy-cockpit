import { TZDate } from "@date-fns/tz";
/** Native Date-compatible calendar arithmetic anchored to the reporting timezone. */
export class BerlinDate extends TZDate {
  constructor(...args) {
    super(...(args.length ? args : [Date.now()]), "Europe/Berlin");
  }
}
