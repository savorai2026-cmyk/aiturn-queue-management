import IconButton, { TrashIcon } from '../../../shared/components/IconButton';
import HelpTip from '../../../shared/components/HelpTip';
import { HourMinuteField } from '../../../shared/components/HourMinuteField';
import {
  suggestTentativeRange,
  type TentativeRange,
  type WorkingShift,
} from '../../appointments/workingHours';
import styles from './TentativeRangesEditor.module.css';

interface TentativeRangesEditorProps {
  ranges: TentativeRange[];
  shifts: WorkingShift[];
  onChange: (ranges: TentativeRange[]) => void;
}

export default function TentativeRangesEditor({
  ranges,
  shifts,
  onChange,
}: TentativeRangesEditorProps) {
  return (
    <div className={styles.tentative}>
      <div className={styles.head}>
        <span className={styles.title}>
          שוקל סגירה
          <HelpTip text="השעות נשארות פתוחות, ותורים שכבר קיימים לא מבוטלים. לקוח שמבקש תור בטווח נשאל אם הוא מתעקש. כשמספיק לקוחות מתעקשים, הטווח הזה יורד והעסק מקבל הודעה. לא נקבע עבורם תור." />
        </span>
        <button
          type="button"
          className={styles.add}
          onClick={() => onChange([...ranges, suggestTentativeRange(shifts)])}
        >
          הוסף טווח
        </button>
      </div>
      {ranges.length === 0 ? (
        <p className={styles.empty}>אין טווח שסומן כסגירה טנטטיבית.</p>
      ) : (
        ranges.map((range, index) => (
          <div key={`${range.start}-${range.end}-${index}`} className={styles.row}>
            <HourMinuteField
              aria-label={`תחילת סגירה טנטטיבית ${index + 1}`}
              value={range.start}
              onChange={(start) =>
                onChange(
                  ranges.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, start } : item,
                  ),
                )
              }
            />
            <span>עד</span>
            <HourMinuteField
              aria-label={`סיום סגירה טנטטיבית ${index + 1}`}
              value={range.end}
              onChange={(end) =>
                onChange(
                  ranges.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, end } : item,
                  ),
                )
              }
            />
            <label className={styles.insist}>
              <span>מתעקשים</span>
              <input
                type="number"
                min="1"
                step="1"
                dir="ltr"
                aria-label={`כמה לקוחות צריכים להתעקש בטווח ${index + 1}`}
                value={range.min_insists}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  onChange(
                    ranges.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            min_insists: Number.isFinite(next) ? next : 1,
                          }
                        : item,
                    ),
                  );
                }}
              />
            </label>
            <IconButton
              label={`מחק סגירה טנטטיבית ${index + 1}`}
              variant="danger"
              onClick={() =>
                onChange(ranges.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              <TrashIcon />
            </IconButton>
          </div>
        ))
      )}
    </div>
  );
}
