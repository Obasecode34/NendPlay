import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { getMobileAdsModule } from './mobileAds'

const extra = Constants.expoConfig?.extra || {}
const fallbackTestIds = {
  Banner: 'ca-app-pub-3940256099942544/6300978111',
  Rewarded: 'ca-app-pub-3940256099942544/5224354917',
  Native: 'ca-app-pub-3940256099942544/2247696110',
  AppOpen: 'ca-app-pub-3940256099942544/9257395921',
}

const testIdKeys = {
  Banner: 'BANNER',
  Rewarded: 'REWARDED',
  Native: 'NATIVE',
  AppOpen: 'APP_OPEN',
}

export function shouldUseTestAds() {
  return Boolean(__DEV__ || extra.adMobUseTestAds)
}

export function areAdsEnabled() {
  return extra.adMobAdsEnabled !== false
}

export function areSsvRewardsEnabled() {
  return extra.adMobSsvRewardsEnabled === true
}

export function getAdUnit(kind) {
  const key = Platform.select({
    android: `adMobAndroid${kind}Id`,
    ios: `adMobIos${kind}Id`,
    default: null,
  })

  const ads = getMobileAdsModule()
  const fallback = ads?.TestIds?.[testIdKeys[kind]] || fallbackTestIds[kind]

  if (shouldUseTestAds()) return fallback

  return (key && extra[key]) || fallback
}
