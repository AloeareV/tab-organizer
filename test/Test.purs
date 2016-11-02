module Pauan.Prelude.Test
  ( module Pauan.Prelude
  , module Test.Unit
  , module Test.Unit.Assert
  , module Test.Unit.Main
  , module Test.Unit.QuickCheck
  , Push
  , makePush
  , runPush
  , getPush
  , equalPush
  , Tests
  , TestOutput
  ) where

import Pauan.Prelude
import Control.Monad.Eff.Console (CONSOLE)
import Control.Monad.Aff.AVar (AVAR)
import Test.Unit (suite, test, TestSuite)
import Test.Unit.Assert (equal)
import Test.Unit.Console (TESTOUTPUT)
import Test.Unit.Main (runTest)
import Test.Unit.QuickCheck (quickCheck)

import Pauan.Mutable as Mutable
import Data.Array (snoc)


type Tests = forall eff. TestSuite (mutable :: Mutable.MUTABLE | eff)

type TestOutput = Eff (console :: CONSOLE, testOutput :: TESTOUTPUT, avar :: AVAR, mutable :: Mutable.MUTABLE) Unit


-- TODO use a newtype for this ?
type Push a = Mutable.Mutable (Array a)


makePush :: forall a eff.
  Aff (mutable :: Mutable.MUTABLE | eff) (Push a)
makePush = Mutable.make [] >> liftEff


runPush :: forall a eff.
  Push a ->
  a ->
  Eff (mutable :: Mutable.MUTABLE | eff) Unit
runPush var value = runTransaction do
  var >> Mutable.modify \a -> value >> snoc a


getPush :: forall a eff.
  Push a ->
  Aff (mutable :: Mutable.MUTABLE | eff) (Array a)
getPush var = liftEff << runTransaction do
  var >> Mutable.get


equalPush :: forall a eff. (Eq a, Show a) =>
  Array a ->
  Push a ->
  Aff (mutable :: Mutable.MUTABLE | eff) Unit
equalPush expected var = do
  output <- getPush var
  output >> equal expected