import React, { useEffect, useState, useRef } from "react";
import tw from "twrnc";
import {
	Image,
	View,
	GestureResponderEvent,
	PanResponder,
	Keyboard,
	ImageSourcePropType,
} from "react-native";
import {
	themeUpdateType,
	useTheme,
	useThemeUpdate,
} from "../src/theme-context";
import { initializeSocket } from "../src/sockets";
import { addQueue, setWebEvents } from "../src/keyboarding";
import { TouchMove, TouchEnd, TouchStart } from "../src/touchlibrary";
import {
	updateMagnifyingGlass,
	MagnifyingGlass,
	FingerInfo,
	setFingerType,
	Coordinate,
} from "./magnifyingglass";
import { ChatInput } from "./chatinput";

//TwoFingerScrolling
const TwoFingerRate = 1 / 20; //scroll rate, todo: customizeable / fix this shit (too fast)
type gestureType = { dir: Coordinate; counter: Coordinate };
let scrolling = false,
	gesturing = {} as gestureType;
function TwoFingerScroll(ev: GestureResponderEvent, lastTouch: Coordinate) {
	if (!(ev.nativeEvent.touches.length > 1 || scrolling)) return;
	const e = ev.nativeEvent;
	const plusOrMinusX = lastTouch.x - e.pageX > 0 ? -1 : 1;
	const plusOrMinusY = lastTouch.y - e.pageY > 0 ? 1 : -1;
	const dir = gesturing.dir || { x: null, y: null };
	let pOmX = dir.x || plusOrMinusX,
		pOmY = dir.y || plusOrMinusY;
	const counter = gesturing.counter || { x: null, y: null };
	if (pOmX !== plusOrMinusX) counter.x++;
	if (pOmY !== plusOrMinusY) counter.y++;
	if (counter.x === 3) {
		counter.x = 0;
		pOmX = plusOrMinusX;
		gesturing.dir.x = pOmX;
	}
	if (counter.y === 3) {
		counter.y = 0;
		pOmY = plusOrMinusY;
		gesturing.dir.y = pOmY;
	}
	addQueue("scrllms", -TwoFingerRate * pOmX, -TwoFingerRate * pOmY);
	if (!gesturing.dir)
		gesturing = {
			counter: { x: 0, y: 0 },
			dir: { x: plusOrMinusX, y: plusOrMinusY },
		};
	return false;
}

//events: using TouchLibrary base
function TouchMoveAndHandleControls(
	e: GestureResponderEvent,
	setFinger: setFingerType
) {
	e.persist();
	updateMagnifyingGlass(setFinger, e.nativeEvent.pageX, e.nativeEvent.pageY);
	TwoFingerScroll(e, TouchMove(e));
	TSTM_Ref = clearTimeout(+TSTM_Ref);
}
let TSTM_Ref: NodeJS.Timeout | void; //shows the magnifyingGlass if maintaining mouse position afterTouchStart w/ no movement
function TouchStartBlurInput(
	e: GestureResponderEvent,
	setFinger: setFingerType
) {
	Keyboard.dismiss();
	e.persist();
	TouchStart(e);
	TSTM_Ref = setTimeout(() => TouchMoveAndHandleControls(e, setFinger), 500);
}
function TouchEndAndHandleControls(e: GestureResponderEvent) {
	scrolling = false;
	e.persist();
	TouchEnd(e);
	TSTM_Ref = clearTimeout(+TSTM_Ref);
}

//the Screen component
export function Screen() {
	const { uri, cachedUri, isUriLoaded } = useTheme();
	const [finger, setFinger] = useState(null as FingerInfo | null);
	const setStore = useThemeUpdate();
	useEffect(() => {
		initializeSocket(setStore);
		setWebEvents();
	}, []);
	const panHandlers =
		OS === "web"
			? {
					onStartShouldSetResponder: () => true,
					onResponderEnd: (e: GestureResponderEvent) =>
						TouchEndAndHandleControls(e),
					onResponderStart: (e: GestureResponderEvent) =>
						TouchStartBlurInput(e, setFinger),
					onResponderMove: (e: GestureResponderEvent) =>
						TouchMoveAndHandleControls(e, setFinger),
			  }
			: {
					onStartShouldSetPanResponder: () => true,
					onPanResponderGrant: (e: GestureResponderEvent) =>
						TouchStartBlurInput(e, setFinger),
					onPanResponderMove: (e: GestureResponderEvent) =>
						TouchMoveAndHandleControls(e, setFinger),
					onPanResponderRelease: (e: GestureResponderEvent) =>
						TouchEndAndHandleControls(e),
			  };
	const panResponder =
		OS === "web"
			? { panHandlers }
			: useRef(PanResponder.create(panHandlers)).current;
	return (
		<View style={tw`w-full h-full overflow-hidden`}>
			<Image
				{...panResponder.panHandlers}
				source={OS === "web" ? cachedUri : { uri }}
				style={[
					{ resizeMode: "stretch" },
					tw`${
						OS === "web" ? "select-none" : ""
					} w-full h-full bg-black`,
				]}
			/>
			<MagnifyingGlass
				bgx={finger?.bgx! || 0}
				bgy={finger?.bgy! || 0}
				x={finger?.x || 0}
				y={finger?.y || 0}
				hidden={!finger ? true : false}
				uri={
					(isUriLoaded
						? OS === "web"
							? cachedUri
							: uri
						: uri) as ImageSourcePropType
				}
				setFinger={setFinger}
				onLoadEnd={() => {
					if (isUriLoaded || OS !== "web") return;
					setStore((prevStore) => ({
						...prevStore,
						cachedUri: uri as ImageSourcePropType,
						uri: "",
						isUriLoaded: true,
					}));
				}}
			/>
			<ChatInput />
		</View>
	);
}
