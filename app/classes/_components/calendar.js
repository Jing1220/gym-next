// CourseCalendar.js
import styles from './_styles/calendar.module.css'
import { useState, useEffect } from 'react'
import moment from 'moment-timezone'
import ReservationModal from './reservation-modal'
import { CLASSES_CAPACITY_GET } from '../../../config/api-path'
import { CLASSES_RESERVATION_POST } from '../../../config/api-path'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'

export default function CourseCalendar({
  currentDate = new Date(),
  classes = [],
  location = '',
  branch = '',
  onReservationSuccess,
}) {
  const [selectedClass, setSelectedClass] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(currentDate)
  const today = moment().tz('Asia/Taipei').startOf('day')
  const { auth, getAuthHeader } = useAuth()
  const router = useRouter()

  // Toast
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: false,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer
      toast.onmouseleave = Swal.resumeTimer
    },
  })

  // 計算週期範圍
  const getWeekRange = (date) => {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
  }

  // 生成週曆天數陣列
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    return moment(selectedDate)
      .tz('Asia/Taipei')
      .startOf('week')
      .add(i, 'days')
      .toDate()
  })

  // 處理週期切換
  const handleNextWeek = () => {
    const next = new Date(selectedDate)
    next.setDate(selectedDate.getDate() + 7)
    setSelectedDate(next)
  }
  const handlePrevWeek = () => {
    const prev = new Date(selectedDate)
    prev.setDate(selectedDate.getDate() - 7)

    if (!isPastWeek()) {
      setSelectedDate(prev)
    }
  }

  // 根據日期過濾課程
  const getCoursesByDay = (day) => {
    const dayMoment = moment(day).tz('Asia/Taipei').startOf('day')
    return classes.filter((course) => {
      const courseMoment = moment(course.date || course.date)
        .tz('Asia/Taipei')
        .startOf('day')
      return dayMoment.isSame(courseMoment, 'day')
    })
  }

  const isPastWeek = () => {
    const today = moment().tz('Asia/Taipei').endOf('day')

    const selectedWeekStart = moment(selectedDate)
      .tz('Asia/Taipei')
      .startOf('week')
      .endOf('day')

    return selectedWeekStart.isSameOrBefore(today)
  }

  const needlogin = () => {
    document.body.style.overflow = 'hidden'
    const MySwal = withReactContent(Swal)
    MySwal.fire({
      title: '登入會員即可預約!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f87808',
      cancelButtonColor: '#0b3760',
      confirmButtonText: '登入',
      cancelButtonText: '取消',
      didClose: () => {
        document.body.style.overflow = ''
      },
    }).then((result) => {
      if (result.isConfirmed) {
        router.push('/member/login')
      }
    })
  }

  // 處理卡片點擊

  const handleCardClick = (classData) => {
    if (!auth.id) {
      needlogin()
      return
    }

    console.log('Clicked classData:', classData) // 先看看收到的資料

    if (!classData || !classData.date) {
      console.error('Error: classData or date is undefined')
      return
    }
    // 這裡不要用 setSelectedClass 覆蓋所有資料
    setSelectedClass(classData) // 直接使用完整的 classData
    setIsModalOpen(true)
  }

  // 處理預約提交
  const handleReservationSubmit = async () => {
    if (!auth.id) {
      needlogin()
      return
    }

    try {
      const capacityRes = await fetch(
        `${CLASSES_CAPACITY_GET}/${selectedClass.id}`
      )
      const capacity = await capacityRes.json()

      if (capacity.current_capacity >= capacity.max_capacity) {
        setIsModalOpen(false)
        Toast.fire({
          icon: 'error',
          title: '課程已額滿',
        })
        return
      }

      // 提交預約
      const res = await fetch(`${CLASSES_RESERVATION_POST}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          member_id: auth.id,
          class_id: selectedClass.id,
          coach_id: selectedClass.coach_id,
          reservation_date: moment(selectedClass.date).format('YYYY-MM-DD'),
          reservation_time: selectedClass.start_time,
        }),
      })

      // 重複預約
      if (res.status === 400) {
        setIsModalOpen(false)
        Toast.fire({
          icon: 'info',
          title: '你已預約過此課程',
        })
        return
      }

      if (!res.ok) {
        setIsModalOpen(false)
        Toast.fire({
          icon: 'error',
          title: '預約失敗',
        })
        return
      }

      setIsModalOpen(false)
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: '預約成功',
        showConfirmButton: true,
        showCancelButton: true,
        confirmButtonText: '前往預約列表',
        cancelButtonText: '返回',
        confirmButtonColor: '#f87808',
        cancelButtonColor: '#6F6F6F',
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = '/member-center/reservation';
        } else {
          setIsModalOpen(false);
        }
      });
      
      

      if (onReservationSuccess) {
        onReservationSuccess()
      }
    } catch (error) {
      console.error('Reservation failed:', error)
      setIsModalOpen(false)
      Toast.fire({
        icon: 'error',
        title: error.message,
      })
    }
  }

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.containerH2}>
          {location && branch ? `${location}${branch}課程表` : '課程表'}
        </h2>
        
        <div className={styles.header}>
          <button
            onClick={handlePrevWeek}
            className={styles.nextWeek}
            disabled={isPastWeek(selectedDate)}
          >
            ＜
          </button>
          <div className={styles.dateInfo}>
            {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月第
            {Math.ceil(selectedDate.getDate() / 7)}週
          </div>
          <button onClick={handleNextWeek} className={styles.nextWeek}>
            ＞
          </button>
        </div>
        <div className={styles.filter}>
          <div className={styles.filterItem}>入門課程</div>
          <div className={styles.filterItem}>進階課程</div>
          <div className={styles.filterItem}>團體課程</div>
          <div className={styles.filterItem}>其他課程</div>
        </div>

        <div className={styles.calendar}>
          {/* 先渲染所有日期 */}
          <div className={styles.days}>
            {weekDays.map((day) => {
              // 將每個日期轉換為當地時區的開始時間
              const localDay = moment(day).tz('Asia/Taipei').startOf('day') // 當地時間的開始 (00:00)

              return (
                <div
                  key={day.getTime()}
                  className={`${styles.day} ${
                    localDay.isSame(today, 'day') ? styles.today : ''
                  }`} // 比較日期
                >
                  <div className={styles.dayNumber}>{day.getDate()}</div>
                  <div className={styles.weekday}>
                    {
                      [
                        '星期日',
                        '星期一',
                        '星期二',
                        '星期三',
                        '星期四',
                        '星期五',
                        '星期六',
                      ][day.getDay()]
                    }
                  </div>
                </div>
              )
            })}
          </div>

          {/* 再渲染所有課程 */}
          <div className={styles.eventsWrapper}>
            {weekDays.map((day) => {
              const dayCourses = getCoursesByDay(day)
              return (
                <div
                  key={`events-${day.getTime()}`}
                  className={`${styles.eventsContainer} ${
                    dayCourses?.length > 0 ? styles.hasEvent : ''
                  }`}
                >
                  {dayCourses.length > 0 ? (
                    dayCourses.map((course) => (
                      <div
                        key={course.id}
                        className={`${styles.event} ${
                          moment(course.date).tz('Asia/Taipei').isBefore(moment().tz('Asia/Taipei'), 'day')

                            ? styles.expired
                            : course.current_capacity >= course.max_capacity
                            ? styles.full
                            : ''
                        }`}
                        data-category={course.category_name}
                        role="button"
                        tabIndex={
                          moment(course.date).tz('Asia/Taipei').isBefore(moment().tz('Asia/Taipei'), 'day')
 ||
                          course.current_capacity >= course.max_capacity
                            ? -1
                            : 0
                        }
                        onClick={() =>
                          moment(course.date).tz('Asia/Taipei').isBefore(moment().tz('Asia/Taipei'), 'day')
 ||
                          course.current_capacity >= course.max_capacity
                            ? null
                            : handleCardClick(course)
                        }
                        onKeyPress={(e) => {
                          if (
                            moment(course.date).isBefore(
                              moment(),
                              'day'
                            ) ||
                            course.current_capacity >= course.max_capacity
                          )
                            return
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleCardClick(course)
                          }
                        }}
                      >
                        {course.title}
                        <div className={styles.time}>{course.time}</div>
                        <div className={styles.name}>{course.coach_name}</div>
                        <div className={styles.capacity}>
                          {moment(course.date).isBefore(
                            moment(),
                            'day'
                          ) ? (
                            <span className={styles.expired}>已過期</span>
                          ) : course.current_capacity >= course.max_capacity ? (
                            <span className={styles.full}>已額滿</span>
                          ) : (
                            <span className={styles.available}>
                              人數 :
                              {course.current_capacity} /{' '}
                              {course.max_capacity}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.noEvent}>本日尚無課程</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        classData={selectedClass}
        onSubmit={handleReservationSubmit}
      />
    </>
  )
}
