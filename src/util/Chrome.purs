module Pauan.Chrome
  ( module Pauan.Chrome.Windows
  , module Pauan.Chrome.Util
  ) where

import Pauan.Chrome.Windows (WindowsState, Coordinates, initialize, windows, createNewWindow, changeWindow, WindowType(..), WindowState(..), windowState, windowCoordinates, windowIsPopup, closeWindow, windowIsNormal, events)

import Pauan.Chrome.Util (resolvePath)
