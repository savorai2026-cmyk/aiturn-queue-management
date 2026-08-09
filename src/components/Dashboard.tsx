import { useState } from 'react';
import { SidePanel } from './SidePanel';
import type { Appointment } from './EditAppointmentModal';

// import { CalendarView } from './CalendarView'; // הסר הערה זו בהתאם לקובץ שלך

export const Dashboard = () => {
  // ניהול הסטייט של התור הנוכחי
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  // פונקציה לעדכון התור במסד הנתונים
  const handleUpdateAppointment = async (updatedData: Appointment) => {
    console.log("Updating DB with: ", updatedData);
    
    // TODO: הוסף כאן את שאילתת העדכון למסד הנתונים (Supabase / Firebase)
    // לאחר הצלחת העדכון בשרת, נעדכן את הסטייט המקומי:
    
    setSelectedAppt(updatedData);
  };

  return (
    <div className="flex w-full min-h-screen bg-gray-50 p-4 gap-4">
      
      {/* צד ימין (או שמאל תלוי ב-RTL): תצוגת היומן המרכזית */}
      <div className="flex-1 bg-white shadow-sm border-[1px] border-gray-200 rounded-lg p-4">
        {/* 
          כאן אתה קורא לקומפוננטת היומן שלך שבה לחצת על האירועים
          <CalendarView onEventClick={(appt) => setSelectedAppt(appt)} />
        */}
        <div className="text-gray-500 font-light text-center mt-10">
          כאן יופיע ה-CalendarView שלך. ודא שהוא מעביר נתונים ל-setSelectedAppt בלחיצה.
        </div>
      </div>

      {/* פאנל פרטים נבחרים - רוחב קבוע */}
      <div className="w-[350px]">
        <SidePanel 
          appointment={selectedAppt} 
          onUpdate={handleUpdateAppointment} 
        />
      </div>

    </div>
  );
};