import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getHeatmapClass(amount, maxAmount) {
  if (!amount || amount === 0) return 'bg-gray-50';
  const ratio = amount / maxAmount;
  if (ratio < 0.25) return 'bg-green-100';
  if (ratio < 0.5) return 'bg-green-300';
  if (ratio < 0.75) return 'bg-green-500 text-white';
  return 'bg-green-700 text-white';
}

function formatINR(amount) {
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return `₹${Math.round(amount)}`;
}

export default function CalendarGrid({ year, month, calendarData = {}, selectedDay, onDayClick }) {
  const firstDay = startOfMonth(new Date(year, month - 1));
  const lastDay = endOfMonth(firstDay);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const startOffset = getDay(firstDay); // 0=Sun

  const amounts = Object.values(calendarData).filter(Boolean);
  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 1;

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Empty cells for offset */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const amount = calendarData[key] || 0;
          const heatClass = getHeatmapClass(amount, maxAmount);
          const isSelected = selectedDay && isSameDay(day, new Date(selectedDay));

          return (
            <button
              key={key}
              onClick={() => onDayClick && onDayClick(key)}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center p-0.5
                text-xs transition-all cursor-pointer hover:ring-2 hover:ring-green-400
                ${heatClass}
                ${isSelected ? 'ring-2 ring-green-600 ring-offset-1' : ''}
              `}
            >
              <span className="font-medium leading-none">{format(day, 'd')}</span>
              {amount > 0 && (
                <span className="text-[9px] leading-tight opacity-80 mt-0.5">
                  {formatINR(amount)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
