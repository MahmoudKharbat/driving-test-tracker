import AsyncStorage from '@react-native-async-storage/async-storage';

/** Remembering the last city removes two taps from every entry. He works one
 *  test centre at a time, so the previous choice is nearly always right.
 *  Shared by the new-test screen and the add sheet. */
const LAST_CITY_KEY = 'lastCity';

export function getLastCity(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_CITY_KEY);
}

export function setLastCity(city: string): void {
  void AsyncStorage.setItem(LAST_CITY_KEY, city);
}
