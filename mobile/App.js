// App.js
import { registerRootComponent } from 'expo'
import React, { useEffect } from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { AppState, View, ActivityIndicator } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import './src/utils/compactUiScale'
import useAuthStore from './src/services/authStore.native'
import useThemeStore from './src/stores/themeStore'
import AppNavigator from './src/navigation/AppNavigator'
import { registerForPushNotificationsAsync } from './src/services/pushNotifications'
import useAppOpenAd from './src/components/ads/useAppOpenAd'
import { initializeMobileAds } from './src/components/ads/mobileAds'

const navigationRef = createNavigationContainerRef()

function openNotificationTarget(data = {}) {
  if (!navigationRef.isReady()) return
  const contentType = data.contentType || ''
  const contentId = data.contentId || data.newsId || data.mediaId || ''

  if (contentType === 'news' && contentId) {
    navigationRef.navigate('NewsDetail', { newsId: contentId })
    return
  }

  if (contentType === 'media' && contentId) {
    navigationRef.navigate('MediaPlayer', { mediaId: contentId })
    return
  }

  if (data.screen === 'News') {
    navigationRef.navigate('MainTabs', { screen: 'Home', params: { screen: 'DailyNews' } })
  } else if (data.screen === 'Rewards') {
    navigationRef.navigate('Rewards')
  } else if (data.screen === 'Subscription') {
    navigationRef.navigate('Subscribe')
  } else if (data.screen === 'Downloads') {
    navigationRef.navigate('MainTabs', { screen: 'Downloads' })
  }
}

export default function App() {
  const { isAuthenticated, isLoading, initAuth } = useAuthStore()
  const { theme, loadTheme } = useThemeStore()
  const [adsReady, setAdsReady] = React.useState(false)
  const c = theme.colors
  useAppOpenAd(adsReady && !isLoading)

  useEffect(() => {
    const init = async () => {
      initializeMobileAds().then(setAdsReady)
      await loadTheme()
      await initAuth()
    }
    init()
  }, [])

  useEffect(() => {
    if (isLoading) return
    registerForPushNotificationsAsync().catch(() => {})
  }, [isLoading])

  useEffect(() => {
    if (!isAuthenticated) return
    registerForPushNotificationsAsync().catch(() => {})
  }, [isAuthenticated])

  useEffect(() => {
    if (isLoading) return undefined
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        registerForPushNotificationsAsync().catch(() => {})
      }
    })
    return () => subscription.remove()
  }, [isLoading])

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationTarget(response.notification.request.content.data || {})
    })
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) openNotificationTarget(response.notification.request.content.data || {})
      })
      .catch(() => {})
    return () => subscription.remove()
  }, [])

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={c.bgDeep} />
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}

registerRootComponent(App)
