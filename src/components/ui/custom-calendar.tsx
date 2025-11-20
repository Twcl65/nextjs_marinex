"use client"

import React from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface ServiceSchedule {
  serviceName: string
  startDate: Date
  endDate: Date
  color: string
}

interface CustomCalendarProps {
  selectedDates: Date[]
  workDays: Date[]
  onDateSelect?: (date: Date) => void
  className?: string
  serviceSchedules?: ServiceSchedule[]
}

export function CustomCalendar({ 
  selectedDates, 
  workDays, 
  onDateSelect, 
  className,
  serviceSchedules = []
}: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const isWorkDay = (date: Date) => {
    return workDays.some(workDay => 
      workDay.getDate() === date.getDate() &&
      workDay.getMonth() === date.getMonth() &&
      workDay.getFullYear() === date.getFullYear()
    )
  }

  const isSelected = (date: Date) => {
    return selectedDates.some(selectedDate =>
      selectedDate.getDate() === date.getDate() &&
      selectedDate.getMonth() === date.getMonth() &&
      selectedDate.getFullYear() === date.getFullYear()
    )
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear()
  }

  const getServiceForDate = (date: Date) => {
    const service = serviceSchedules.find(schedule => {
      const dateTime = date.getTime()
      const startTime = schedule.startDate.getTime()
      const endTime = schedule.endDate.getTime()
      const isInRange = dateTime >= startTime && dateTime <= endTime
      
      // Debug logging for specific dates
      if (date.getDate() === 19 && date.getMonth() === 10) { // November 19
        console.log(`Checking Nov 19:`, {
          date: date.toDateString(),
          service: schedule.serviceName,
          startDate: schedule.startDate.toDateString(),
          endDate: schedule.endDate.toDateString(),
          isInRange,
          color: schedule.color
        })
      }
      
      return isInRange
    })
    
    return service
  }

  const getServiceColor = (colorName: string) => {
    const colorMap: Record<string, string> = {
      'green-500': '#10b981',
      'blue-500': '#3b82f6',
      'purple-500': '#8b5cf6',
      'orange-500': '#f97316',
      'red-500': '#ef4444',
      'yellow-500': '#eab308'
    }
    return colorMap[colorName] || '#6b7280'
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const days = getDaysInMonth(currentMonth)

  // Debug logging
  React.useEffect(() => {
    console.log('Calendar received service schedules:', serviceSchedules)
  }, [serviceSchedules])

  return (
    <div className={cn("w-fit max-w-xs mx-auto bg-white p-3", className)}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <h2 className="text-base font-semibold text-gray-800">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <ChevronDown className="h-3 w-3 text-gray-600" />
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousMonth}
            className="h-6 w-6 hover:bg-gray-100 rounded-none p-0"
          >
            <ChevronLeft className="h-3 w-3 text-gray-600" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            className="h-6 w-6 hover:bg-gray-100 rounded-none p-0"
          >
            <ChevronRight className="h-3 w-3 text-gray-600" />
          </Button>
        </div>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 gap-0 mb-3">
        {dayNames.map((day, index) => (
          <div key={index} className="text-center text-sm font-normal text-gray-600 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((date, index) => {
          if (!date) {
            return <div key={index} className="h-10" />
          }

          const workDay = isWorkDay(date)
          const selected = isSelected(date)
          const today = isToday(date)
          const serviceForDate = getServiceForDate(date)

          // Determine the background color and text color
          let backgroundColor = ''
          let textColor = ''
          let borderColor = ''
          
          if (selected) {
            backgroundColor = '#10b981' // green-500
            textColor = 'white'
            borderColor = '#10b981'
          } else if (workDay && serviceForDate) {
            backgroundColor = getServiceColor(serviceForDate.color)
            textColor = 'white'
          } else if (workDay && !serviceForDate) {
            backgroundColor = '#e5e7eb' // gray-200
            textColor = '#1f2937' // gray-800
          } else if (today && !workDay && !selected) {
            textColor = '#2563eb' // blue-600
          } else {
            textColor = '#374151' // gray-700
          }

          return (
            <div
              key={index}
              className={cn(
                "h-10 w-10 flex items-center justify-center text-base font-normal cursor-pointer transition-all duration-200 relative rounded-full",
                today && !workDay && !selected ? "font-medium" : "",
                !workDay && !selected && !today ? "hover:bg-gray-100" : ""
              )}
              style={{
                backgroundColor: backgroundColor || undefined,
                color: textColor,
                border: borderColor ? `1px solid ${borderColor}` : undefined
              }}
              onClick={() => onDateSelect?.(date)}
              title={serviceForDate ? serviceForDate.serviceName : undefined}
            >
              {date.getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
