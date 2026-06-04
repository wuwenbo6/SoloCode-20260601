import { useState, useCallback, useRef } from 'react'

interface LocationResult {
  latitude: number | null
  longitude: number | null
  accuracy?: number
}

export function useGeolocation() {
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [locationSource, setLocationSource] = useState<'gps' | 'wifi' | null>(null)
  const fetchingRef = useRef(false)

  const fetchIpLocation = useCallback(async (): Promise<LocationResult> => {
    try {
      const res = await fetch('https://ipapi.co/json/')
      const data = await res.json()
      if (data.latitude && data.longitude) {
        return { latitude: data.latitude, longitude: data.longitude, accuracy: 5000 }
      }
      return { latitude: null, longitude: null }
    } catch {
      return { latitude: null, longitude: null }
    }
  }, [])

  const requestLocation = useCallback(() => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    if (!navigator.geolocation) {
      setError('浏览器不支持定位，使用IP定位')
      fetchIpLocation().then((loc) => {
        if (loc.latitude) {
          setLatitude(loc.latitude)
          setLongitude(loc.longitude)
          setLocationSource('wifi')
        }
        fetchingRef.current = false
      })
      return
    }

    const gpsTimeout = setTimeout(() => {
      setError('GPS获取超时，使用WiFi/IP定位')
      setLocationSource('wifi')
      fetchIpLocation().then((loc) => {
        if (loc.latitude) {
          setLatitude(loc.latitude)
          setLongitude(loc.longitude)
        }
      })
    }, 8000)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(gpsTimeout)
        if (position.coords.accuracy && position.coords.accuracy < 50) {
          setLatitude(position.coords.latitude)
          setLongitude(position.coords.longitude)
          setError(null)
          setLocationSource('gps')
          fetchingRef.current = false
        } else {
          setError('GPS精度不足，使用WiFi/IP定位')
          setLocationSource('wifi')
          fetchIpLocation().then((loc) => {
            if (loc.latitude) {
              setLatitude(loc.latitude)
              setLongitude(loc.longitude)
            }
            fetchingRef.current = false
          })
        }
      },
      (err) => {
        clearTimeout(gpsTimeout)
        if (err.code === 1) {
          setError('定位权限被拒绝，使用IP定位')
        } else if (err.code === 2) {
          setError('定位不可用，使用IP定位')
        } else {
          setError(err.message + '，使用IP定位')
        }
        setLocationSource('wifi')
        fetchIpLocation().then((loc) => {
          if (loc.latitude) {
            setLatitude(loc.latitude)
            setLongitude(loc.longitude)
          }
          fetchingRef.current = false
        })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [fetchIpLocation])

  return { latitude, longitude, error, requestLocation, locationSource }
}
