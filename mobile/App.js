// App.js
import { registerRootComponent } from 'expo'
import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={c.bgDeep} />
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}

registerRootComponent(App)
