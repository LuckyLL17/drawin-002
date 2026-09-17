import { useState, useEffect, useRef } from 'react';
import { Drawnix, DrawnixToolState } from '@drawnix/drawnix';
import type { Presentation } from '@drawnix/drawnix';
import { PlaitElement, PlaitTheme, Viewport } from '@plait/core';
import localforage from 'localforage';

type AppValue = {
  children: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
  presentations?: Presentation[];
};

type Language = 'zh' | 'en' | 'ru' | 'ar' | 'vi';

type MainBoardPreference = {
  language: Language;
  copyTransparent: boolean;
  exportTransparent: boolean;
};

const MAIN_BOARD_CONTENT_KEY = 'main_board_content';
const MAIN_BOARD_TOOL_STATE_KEY = 'main_board_tool_state';
const MAIN_BOARD_PREFERENCE_KEY = 'main_board_preference';

localforage.config({
  name: 'Drawnix',
  storeName: 'drawnix_store',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

export function App() {
  const [value, setValue] = useState<AppValue>({ children: [] });
  const [initialToolState, setInitialToolState] = useState<Partial<DrawnixToolState>>();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const presentationsRef = useRef<Presentation[]>([]);
  const [preference, setPreference] = useState<MainBoardPreference>({
    language: 'zh',
    copyTransparent: false,
    exportTransparent: false,
  });
  const [loaded, setLoaded] = useState(false);

  const [tutorial, setTutorial] = useState(false);

  const updatePreference = (partialPreference: Partial<MainBoardPreference>) => {
    setPreference((currentPreference) => {
      const nextPreference = { ...currentPreference, ...partialPreference };
      localforage.setItem(MAIN_BOARD_PREFERENCE_KEY, nextPreference);
      return nextPreference;
    });
  };

  useEffect(() => {
    const loadData = async () => {
      const [storedData, storedToolState, storedPreference] = await Promise.all([
        localforage.getItem(MAIN_BOARD_CONTENT_KEY),
        localforage.getItem(MAIN_BOARD_TOOL_STATE_KEY),
        localforage.getItem(MAIN_BOARD_PREFERENCE_KEY),
      ]);
      if (storedData) {
        const appValue = storedData as AppValue;
        setValue(appValue);
        const storedPresentations = Array.isArray(appValue.presentations)
          ? appValue.presentations
          : [];
        setPresentations(storedPresentations);
        presentationsRef.current = storedPresentations;
        if (appValue.children && appValue.children.length === 0) {
          setTutorial(true);
        }
      } else {
        setTutorial(true);
      }
      if (storedToolState) {
        setInitialToolState(storedToolState as Partial<DrawnixToolState>);
      }
      if (storedPreference) {
        setPreference(storedPreference as MainBoardPreference);
      }
      setLoaded(true);
    };
    loadData();
  }, []);
  if (!loaded) {
    return null;
  }
  return (
    <Drawnix
      value={value.children}
      viewport={value.viewport}
      theme={value.theme}
      presentations={presentations}
      initialToolState={initialToolState}
      initialLanguage={preference.language}
      initialPreference={{
        copyTransparent: preference.copyTransparent,
        exportTransparent: preference.exportTransparent,
      }}
      onLanguageChange={(language) => {
        updatePreference({ language });
      }}
      onPreferenceChange={({ copyTransparent, exportTransparent }) => {
        updatePreference({ copyTransparent, exportTransparent });
      }}
      onChange={(change) => {
        // Always merge the latest presentation metadata so board/viewport
        // writes can never clobber presentation pages in storage.
        const newValue = { ...(change as AppValue), presentations: presentationsRef.current };
        localforage.setItem(MAIN_BOARD_CONTENT_KEY, newValue);
        setValue(newValue);
        if (newValue.children && newValue.children.length > 0) {
          setTutorial(false);
        }
      }}
      onToolStateChange={(toolState) => {
        localforage.setItem(MAIN_BOARD_TOOL_STATE_KEY, toolState);
      }}
      onPresentationsChange={(nextPresentations) => {
        presentationsRef.current = nextPresentations;
        setPresentations(nextPresentations);
        localforage.getItem(MAIN_BOARD_CONTENT_KEY).then((stored) => {
          const storedValue = (stored as AppValue) ?? { children: [] };
          localforage.setItem(MAIN_BOARD_CONTENT_KEY, {
            ...storedValue,
            presentations: nextPresentations,
          });
        });
      }}
      tutorial={tutorial}
      afterInit={(_board) => {
        console.log('board initialized');
      }}
    ></Drawnix>
  );
}

export default App;
