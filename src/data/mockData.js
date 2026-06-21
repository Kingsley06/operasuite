import { addDays, subDays, format } from '../utils/dateUtils';

const today = new Date();

export const mockRooms = [
  // Floor 1
  { id: 'r1', number: '101', type: 'Single', floor: 1, status: 'Available', pricePerNight: 15000, amenities: ['WiFi', 'AC', 'TV'] },
  { id: 'r2', number: '102', type: 'Single', floor: 1, status: 'Booked', pricePerNight: 15000, amenities: ['WiFi', 'AC', 'TV'] },
  { id: 'r3', number: '103', type: 'Double', floor: 1, status: 'Available', pricePerNight: 25000, amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
  { id: 'r4', number: '104', type: 'Double', floor: 1, status: 'Maintenance', pricePerNight: 25000, amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
  { id: 'r5', number: '105', type: 'Single', floor: 1, status: 'Available', pricePerNight: 15000, amenities: ['WiFi', 'AC', 'TV'] },
  // Floor 2
  { id: 'r6', number: '201', type: 'Double', floor: 2, status: 'Booked', pricePerNight: 25000, amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
  { id: 'r7', number: '202', type: 'Double', floor: 2, status: 'Available', pricePerNight: 25000, amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
  { id: 'r8', number: '203', type: 'Suite', floor: 2, status: 'Booked', pricePerNight: 55000, amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Jacuzzi', 'Lounge'] },
  { id: 'r9', number: '204', type: 'Single', floor: 2, status: 'Available', pricePerNight: 15000, amenities: ['WiFi', 'AC', 'TV'] },
  { id: 'r10', number: '205', type: 'Double', floor: 2, status: 'Cleaning', pricePerNight: 25000, amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
  // Floor 3
  { id: 'r11', number: '301', type: 'Suite', floor: 3, status: 'Available', pricePerNight: 55000, amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Jacuzzi', 'Lounge'] },
  { id: 'r12', number: '302', type: 'Double', floor: 3, status: 'Booked', pricePerNight: 25000, amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
  { id: 'r13', number: '303', type: 'Single', floor: 3, status: 'Available', pricePerNight: 15000, amenities: ['WiFi', 'AC', 'TV'] },
  { id: 'r14', number: '304', type: 'Double', floor: 3, status: 'Booked', pricePerNight: 25000, amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
  { id: 'r15', number: '305', type: 'Single', floor: 3, status: 'Maintenance', pricePerNight: 15000, amenities: ['WiFi', 'AC', 'TV'] },
  // Floor 4
  { id: 'r16', number: '401', type: 'Suite', floor: 4, status: 'Booked', pricePerNight: 75000, amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Jacuzzi', 'Lounge', 'Butler'] },
  { id: 'r17', number: '402', type: 'Suite', floor: 4, status: 'Available', pricePerNight: 75000, amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Jacuzzi', 'Lounge', 'Butler'] },
  { id: 'r18', number: '403', type: 'Double', floor: 4, status: 'Available', pricePerNight: 30000, amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Balcony'] },
  { id: 'r19', number: '404', type: 'Double', floor: 4, status: 'Booked', pricePerNight: 30000, amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Balcony'] },
  { id: 'r20', number: '405', type: 'Single', floor: 4, status: 'Available', pricePerNight: 18000, amenities: ['WiFi', 'AC', 'TV', 'Balcony'] },
];

export const mockGuests = [
  { id: 'g1', firstName: 'Chukwuemeka', lastName: 'Okafor', email: 'c.okafor@gmail.com', phone: '08031234567', idType: 'NIN', idNumber: 'NIN-7823409812', totalStays: 5, lastVisit: format(subDays(today, 30)), notes: 'Prefers high floor rooms' },
  { id: 'g2', firstName: 'Amina', lastName: 'Ibrahim', email: 'amina.ibrahim@yahoo.com', phone: '08059876543', idType: 'International Passport', idNumber: 'A09234871', totalStays: 2, lastVisit: format(subDays(today, 60)), notes: '' },
  { id: 'g3', firstName: 'Babatunde', lastName: 'Adeyemi', email: 'babs.adeyemi@hotmail.com', phone: '09012345678', idType: 'Driver\'s License', idNumber: 'DL-LAG-2019-00123', totalStays: 8, lastVisit: format(subDays(today, 7)), notes: 'VIP guest, wine on arrival' },
  { id: 'g4', firstName: 'Ngozi', lastName: 'Eze', email: 'ngozi.eze@gmail.com', phone: '08112233445', idType: 'NIN', idNumber: 'NIN-5534209871', totalStays: 1, lastVisit: format(subDays(today, 90)), notes: '' },
  { id: 'g5', firstName: 'Emeka', lastName: 'Nwosu', email: 'emeka.nwosu@company.ng', phone: '07034567890', idType: 'International Passport', idNumber: 'B12345678', totalStays: 12, lastVisit: format(subDays(today, 3)), notes: 'Corporate account - Nwosu & Sons Ltd' },
  { id: 'g6', firstName: 'Fatima', lastName: 'Musa', email: 'fatima.musa@outlook.com', phone: '08087654321', idType: 'NIN', idNumber: 'NIN-9912349872', totalStays: 3, lastVisit: format(subDays(today, 15)), notes: '' },
  { id: 'g7', firstName: 'Tolu', lastName: 'Akinwale', email: 'tolu.akinwale@gmail.com', phone: '09098765432', idType: 'Driver\'s License', idNumber: 'DL-OYO-2020-00456', totalStays: 6, lastVisit: format(subDays(today, 45)), notes: 'Allergic to feather pillows' },
  { id: 'g8', firstName: 'Chidinma', lastName: 'Obi', email: 'chi.obi@gmail.com', phone: '08023456789', idType: 'NIN', idNumber: 'NIN-3345678901', totalStays: 2, lastVisit: format(subDays(today, 120)), notes: '' },
  { id: 'g9', firstName: 'Yusuf', lastName: 'Abdullahi', email: 'y.abdullahi@gmail.com', phone: '07045678901', idType: 'International Passport', idNumber: 'C98765432', totalStays: 4, lastVisit: format(subDays(today, 20)), notes: 'Requires halal meal options' },
  { id: 'g10', firstName: 'Adaeze', lastName: 'Nwachukwu', email: 'adaeze.n@yahoo.com', phone: '08056789012', idType: 'Driver\'s License', idNumber: 'DL-IMO-2021-00789', totalStays: 9, lastVisit: format(subDays(today, 5)), notes: 'Loyalty member - Gold tier' },
];

const checkInDates = [
  subDays(today, 5), subDays(today, 3), subDays(today, 1), today,
  addDays(today, 1), addDays(today, 2), subDays(today, 10),
  subDays(today, 7), subDays(today, 2), addDays(today, 3),
  subDays(today, 4), subDays(today, 6), subDays(today, 15), subDays(today, 8), subDays(today, 1)
];

const checkOutDates = [
  addDays(today, 2), addDays(today, 1), addDays(today, 3), addDays(today, 4),
  addDays(today, 5), addDays(today, 7), subDays(today, 3),
  subDays(today, 1), addDays(today, 2), addDays(today, 6),
  addDays(today, 1), subDays(today, 2), subDays(today, 8), subDays(today, 2), addDays(today, 5)
];

function calcNights(checkIn, checkOut) {
  return Math.max(1, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
}

export const mockBookings = [
  { id: 'b1', guestId: 'g3', roomId: 'r2', checkIn: format(checkInDates[0]), checkOut: format(checkOutDates[0]), status: 'Active', paymentStatus: 'Paid', notes: 'Late checkout requested', totalAmount: 25000 * calcNights(checkInDates[0], checkOutDates[0]) },
  { id: 'b2', guestId: 'g5', roomId: 'r6', checkIn: format(checkInDates[1]), checkOut: format(checkOutDates[1]), status: 'Active', paymentStatus: 'Paid', notes: 'Corporate booking', totalAmount: 25000 * calcNights(checkInDates[1], checkOutDates[1]) },
  { id: 'b3', guestId: 'g1', roomId: 'r8', checkIn: format(checkInDates[2]), checkOut: format(checkOutDates[2]), status: 'Active', paymentStatus: 'Partial', notes: '', totalAmount: 55000 * calcNights(checkInDates[2], checkOutDates[2]) },
  { id: 'b4', guestId: 'g10', roomId: 'r12', checkIn: format(checkInDates[3]), checkOut: format(checkOutDates[3]), status: 'Active', paymentStatus: 'Unpaid', notes: 'Airport pickup arranged', totalAmount: 25000 * calcNights(checkInDates[3], checkOutDates[3]) },
  { id: 'b5', guestId: 'g7', roomId: 'r14', checkIn: format(checkInDates[4]), checkOut: format(checkOutDates[4]), status: 'Active', paymentStatus: 'Paid', notes: '', totalAmount: 25000 * calcNights(checkInDates[4], checkOutDates[4]) },
  { id: 'b6', guestId: 'g2', roomId: 'r16', checkIn: format(checkInDates[5]), checkOut: format(checkOutDates[5]), status: 'Active', paymentStatus: 'Paid', notes: 'Honeymoon suite setup', totalAmount: 75000 * calcNights(checkInDates[5], checkOutDates[5]) },
  { id: 'b7', guestId: 'g9', roomId: 'r19', checkIn: format(checkInDates[6]), checkOut: format(checkOutDates[6]), status: 'Checked Out', paymentStatus: 'Paid', notes: '', totalAmount: 30000 * calcNights(checkInDates[6], checkOutDates[6]) },
  { id: 'b8', guestId: 'g4', roomId: 'r3', checkIn: format(checkInDates[7]), checkOut: format(checkOutDates[7]), status: 'Checked Out', paymentStatus: 'Paid', notes: '', totalAmount: 25000 * calcNights(checkInDates[7], checkOutDates[7]) },
  { id: 'b9', guestId: 'g6', roomId: 'r7', checkIn: format(checkInDates[8]), checkOut: format(checkOutDates[8]), status: 'Active', paymentStatus: 'Partial', notes: 'Extra bed requested', totalAmount: 25000 * calcNights(checkInDates[8], checkOutDates[8]) },
  { id: 'b10', guestId: 'g8', roomId: 'r11', checkIn: format(checkInDates[9]), checkOut: format(checkOutDates[9]), status: 'Upcoming', paymentStatus: 'Unpaid', notes: '', totalAmount: 55000 * calcNights(checkInDates[9], checkOutDates[9]) },
  { id: 'b11', guestId: 'g3', roomId: 'r1', checkIn: format(checkInDates[10]), checkOut: format(checkOutDates[10]), status: 'Active', paymentStatus: 'Paid', notes: '', totalAmount: 15000 * calcNights(checkInDates[10], checkOutDates[10]) },
  { id: 'b12', guestId: 'g5', roomId: 'r18', checkIn: format(checkInDates[11]), checkOut: format(checkOutDates[11]), status: 'Checked Out', paymentStatus: 'Paid', notes: '', totalAmount: 30000 * calcNights(checkInDates[11], checkOutDates[11]) },
  { id: 'b13', guestId: 'g1', roomId: 'r17', checkIn: format(checkInDates[12]), checkOut: format(checkOutDates[12]), status: 'Checked Out', paymentStatus: 'Paid', notes: 'Business trip', totalAmount: 75000 * calcNights(checkInDates[12], checkOutDates[12]) },
  { id: 'b14', guestId: 'g10', roomId: 'r20', checkIn: format(checkInDates[13]), checkOut: format(checkOutDates[13]), status: 'Cancelled', paymentStatus: 'Refunded', notes: 'Cancelled due to travel change', totalAmount: 18000 * calcNights(checkInDates[13], checkOutDates[13]) },
  { id: 'b15', guestId: 'g2', roomId: 'r9', checkIn: format(checkInDates[14]), checkOut: format(checkOutDates[14]), status: 'Active', paymentStatus: 'Paid', notes: '', totalAmount: 15000 * calcNights(checkInDates[14], checkOutDates[14]) },
];

export const mockHousekeeping = mockRooms.map(room => ({
  roomId: room.id,
  status: room.status === 'Booked' ? 'Dirty' : room.status === 'Maintenance' ? 'Dirty' : room.status === 'Cleaning' ? 'In Progress' : 'Clean',
  lastCleaned: format(subDays(today, Math.floor(Math.random() * 3))),
  assignedTo: ['Bola A.', 'Kemi T.', 'Uche M.', 'Sade F.'][Math.floor(Math.random() * 4)],
}));

export const mockMaintenance = [
  { id: 'm1', roomId: 'r4', issue: 'Air conditioning not cooling properly', priority: 'High', status: 'In Progress', reportedDate: format(subDays(today, 2)), notes: 'Technician dispatched' },
  { id: 'm2', roomId: 'r15', issue: 'Bathroom tap leaking', priority: 'Medium', status: 'Open', reportedDate: format(subDays(today, 1)), notes: '' },
  { id: 'm3', roomId: 'r8', issue: 'TV remote not working', priority: 'Low', status: 'Resolved', reportedDate: format(subDays(today, 5)), notes: 'Remote replaced' },
  { id: 'm4', roomId: 'r12', issue: 'Wardrobe door hinge broken', priority: 'Low', status: 'Open', reportedDate: format(today), notes: '' },
];
