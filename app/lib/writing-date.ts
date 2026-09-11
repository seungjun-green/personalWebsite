const DEFAULT_WRITING_TIME_ZONE = "Asia/Seoul";

export function currentWritingDate(
  date = new Date(),
  timeZone = process.env.WRITING_TIME_ZONE || DEFAULT_WRITING_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
