import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Zap, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import { Card, StatCard, Btn } from '../components/ui';
import { formatCurrency, todayStr } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';

// --- Smart Pricing Engine ---
function analyzePricing(rooms, bookings) {
  const today = new Date();
  const todayStr2 = todayStr();
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

  const totalRooms = rooms.length;
  const activeBookings = bookings.filter(b => b.status === 'Active');
  const bookedRooms = rooms.filter(r => r.status === 'Booked').length;
  const occupancyRate = totalRooms > 0 ? bookedRooms / totalRooms : 0;

  // Bookings in last 7 days (booking velocity)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const recentBookings = bookings.filter(b => new Date(b.checkIn) >= sevenDaysAgo).length;

  // Upcoming bookings in next 7 days
  const sevenDaysAhead = new Date(today);
  sevenDaysAhead.setDate(today.getDate() + 7);
  const upcomingBookings = bookings.filter(b => {
    const d = new Date(b.checkIn);
    return d >= today && d <= sevenDaysAhead && b.status !== 'Cancelled';
  }).length;

  // Revenue per room type
  const typeStats = {};
  rooms.forEach(r => {
    if (!typeStats[r.type]) typeStats[r.type] = { total: 0, booked: 0, revenue: 0, currentPrice: r.pricePerNight };
    typeStats[r.type].total++;
    if (r.status === 'Booked') typeStats[r.type].booked++;
  });
  bookings.filter(b => b.status !== 'Cancelled').forEach(b => {
    const room = rooms.find(r => r.id === b.roomId);
    if (room && typeStats[room.type]) typeStats[room.type].revenue += b.totalAmount;
  });

  const suggestions = [];

  // Rule 1: High occupancy → raise prices
  if (occupancyRate >= 0.8) {
    suggestions.push({
      type: 'increase',
      urgency: 'high',
      title: 'High Occupancy — Raise Prices',
      reason: `Your hotel is ${Math.round(occupancyRate * 100)}% occupied. Demand is strong.`,
      insight: 'Hotels typically increase rates by 15–25% when occupancy exceeds 80%.',
      rooms: rooms.filter(r => r.status === 'Available'),
      multiplier: occupancyRate >= 0.9 ? 1.25 : 1.15,
    });
  }

  // Rule 2: Low occupancy → lower prices or offer deal
  if (occupancyRate < 0.4 && totalRooms > 5) {
    suggestions.push({
      type: 'decrease',
      urgency: 'medium',
      title: 'Low Occupancy — Consider a Discount',
      reason: `Only ${Math.round(occupancyRate * 100)}% of rooms are filled. A small discount could drive more bookings.`,
      insight: 'A 10–15% reduction often increases booking volume enough to offset the lower rate.',
      rooms: rooms.filter(r => r.status === 'Available'),
      multiplier: 0.88,
    });
  }

  // Rule 3: Weekend premium
  if (isWeekend) {
    suggestions.push({
      type: 'increase',
      urgency: 'medium',
      title: 'Weekend — Apply Weekend Premium',
      reason: 'It\'s the weekend. Demand for leisure travel is typically 20–30% higher.',
      insight: 'Weekend pricing is standard practice across all hotel tiers.',
      rooms: rooms.filter(r => r.status === 'Available'),
      multiplier: 1.20,
    });
  }

  // Rule 4: Suites underperforming
  const suiteStats = typeStats['Suite'];
  if (suiteStats && suiteStats.total > 0 && suiteStats.booked / suiteStats.total < 0.3) {
    suggestions.push({
      type: 'decrease',
      urgency: 'low',
      title: 'Suites Are Slow — Consider a Suite Deal',
      reason: `Only ${Math.round((suiteStats.booked / suiteStats.total) * 100)}% of your suites are booked.`,
      insight: 'Offering a 10% suite discount or bundle (e.g. breakfast included) can unlock this segment.',
      rooms: rooms.filter(r => r.type === 'Suite' && r.status === 'Available'),
      multiplier: 0.90,
    });
  }

  // Rule 5: High booking velocity
  if (recentBookings >= 5) {
    suggestions.push({
      type: 'increase',
      urgency: 'medium',
      title: 'Booking Velocity Is High',
      reason: `${recentBookings} bookings in the last 7 days — above average activity.`,
      insight: 'Strong demand signals room to test slightly higher pricing without losing bookings.',
      rooms: rooms.filter(r => r.status === 'Available' && r.type === 'Single'),
      multiplier: 1.10,
    });
  }

  // Rule 6: Upcoming demand spike
  if (upcomingBookings >= 4) {
    suggestions.push({
      type: 'increase',
      urgency: 'high',
      title: 'Demand Spike Next 7 Days',
      reason: `${upcomingBookings} check-ins expected in the next 7 days.`,
      insight: 'Pre-emptively raising prices before demand peaks maximises revenue.',
      rooms: rooms.filter(r => r.status === 'Available'),
      multiplier: 1.12,
    });
  }

  // If no suggestions
  if (suggestions.length === 0) {
    suggestions.push({
      type: 'neutral',
      urgency: 'low',
      title: 'Pricing Looks Balanced',
      reason: `Occupancy is ${Math.round(occupancyRate * 100)}% — in a healthy mid-range.`,
      insight: 'No immediate pricing changes needed. Check back after the weekend or when occupancy shifts.',
      rooms: [],
      multiplier: 1,
    });
  }

  return { suggestions, occupancyRate, typeStats, recentBookings, upcomingBookings, isWeekend };
}

function SuggestionCard({ suggestion, rooms, onApply }) {
  const [expanded, setExpanded] = useState(false);
  const urgencyColors = { high: 'border-l-red-500 bg-red-50/30', medium: 'border-l-amber-500 bg-amber-50/30', low: 'border-l-blue-400 bg-blue-50/20' };
  const typeColors = { increase: 'text-emerald-600 bg-emerald-100', decrease: 'text-red-600 bg-red-100', neutral: 'text-gray-600 bg-gray-100' };
  const TypeIcon = suggestion.type === 'increase' ? TrendingUp : suggestion.type === 'decrease' ? TrendingDown : Minus;

  const affectedRooms = suggestion.rooms || [];

  return (
    <Card className={`border-l-4 ${urgencyColors[suggestion.urgency]}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${typeColors[suggestion.type]}`}>
              <TypeIcon size={18} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 mb-1">{suggestion.title}</div>
              <p className="text-sm text-gray-600">{suggestion.reason}</p>
              <div className="flex items-start gap-2 mt-2 p-2.5 bg-white/70 rounded-lg">
                <Info size={13} className="text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-500">{suggestion.insight}</p>
              </div>
            </div>
          </div>
          {suggestion.type !== 'neutral' && affectedRooms.length > 0 && (
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`text-sm font-bold ${suggestion.type === 'increase' ? 'text-emerald-600' : 'text-red-600'}`}>
                {suggestion.type === 'increase' ? '+' : ''}{Math.round((suggestion.multiplier - 1) * 100)}%
              </span>
              <Btn size="sm" variant={suggestion.type === 'increase' ? 'primary' : 'secondary'}
                onClick={() => setExpanded(!expanded)}>
                Preview <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </Btn>
            </div>
          )}
        </div>

        {/* Expanded price preview */}
        {expanded && affectedRooms.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-500 mb-3">SUGGESTED PRICE CHANGES</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {affectedRooms.map(room => {
                const newPrice = Math.round(room.pricePerNight * suggestion.multiplier / 1000) * 1000;
                const diff = newPrice - room.pricePerNight;
                return (
                  <div key={room.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100">
                    <div>
                      <span className="font-medium text-gray-800">Room {room.number}</span>
                      <span className="text-xs text-gray-400 ml-2">{room.type} · Floor {room.floor}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 line-through">{formatCurrency(room.pricePerNight)}</span>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(newPrice)}</span>
                      <span className={`text-xs font-medium ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-3">
              <button onClick={() => setExpanded(false)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Dismiss
              </button>
              <button
                onClick={() => { onApply(affectedRooms, suggestion.multiplier); setExpanded(false); }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors">
                Apply to {affectedRooms.length} Room{affectedRooms.length > 1 ? 's' : ''}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">⚠️ You can always revert prices manually in the Rooms section.</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function SmartPricing({ rooms, bookings, onUpdateRoom }) {
  const toast = useToast();
  const analysis = useMemo(() => analyzePricing(rooms, bookings), [rooms, bookings]);
  const { suggestions, occupancyRate, typeStats, recentBookings, upcomingBookings, isWeekend } = analysis;

  const applyPricing = (affectedRooms, multiplier) => {
    affectedRooms.forEach(room => {
      const newPrice = Math.round(room.pricePerNight * multiplier / 1000) * 1000;
      onUpdateRoom(room.id, { pricePerNight: newPrice });
    });
    toast(`Prices updated for ${affectedRooms.length} room${affectedRooms.length > 1 ? 's' : ''}!`);
  };

  const highSuggestions = suggestions.filter(s => s.urgency === 'high').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Smart Pricing</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              <Zap size={11} />AI Powered
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Revenue recommendations based on your occupancy and booking data</p>
        </div>
        {highSuggestions > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-medium text-red-700">{highSuggestions} urgent suggestion{highSuggestions > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Current Occupancy" value={`${Math.round(occupancyRate * 100)}%`}
          color={occupancyRate >= 0.8 ? 'emerald' : occupancyRate < 0.4 ? 'red' : 'blue'} />
        <StatCard icon={Zap} label="Bookings This Week" value={recentBookings} color="purple" />
        <StatCard icon={TrendingUp} label="Arrivals Next 7 Days" value={upcomingBookings} color="amber" />
        <StatCard icon={TrendingUp} label="Today" value={isWeekend ? 'Weekend 🎉' : 'Weekday'} color={isWeekend ? 'emerald' : 'blue'} />
      </div>

      {/* Room type breakdown */}
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Current Pricing by Room Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(typeStats).map(([type, stats]) => {
            const occupancy = stats.total > 0 ? Math.round((stats.booked / stats.total) * 100) : 0;
            return (
              <div key={type} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800">{type}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${occupancy >= 70 ? 'bg-emerald-100 text-emerald-700' : occupancy >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {occupancy}% booked
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(stats.currentPrice)}<span className="text-xs font-normal text-gray-400">/night</span></div>
                <div className="text-xs text-gray-500 mt-1">{stats.total} rooms · {stats.booked} occupied</div>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${occupancy}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* AI Suggestions */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">AI Recommendations</h3>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <SuggestionCard key={i} suggestion={s} rooms={rooms} onApply={applyPricing} />
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <div className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong>How it works:</strong> The AI analyses your current occupancy, booking velocity, day of week, and room type performance to suggest price adjustments. All changes are applied instantly and can be reversed anytime in the Rooms section.
          </div>
        </div>
      </div>
    </div>
  );
}
