import React, { useRef, useState } from "react";
import tw from "twrnc";
import { TextInput, KeyboardAvoidingView } from "react-native";
import { HeldKeysComponent, queueKey } from "../src/keyboarding";
import {
	useTheme,
	useThemeUpdate,
	xType,
	webBlur,
	webFocus,
	mobileBlur,
	mobileFocus,
} from "../src/theme-context";

function findDiff(needle: string, haystack: string) {
	let diff = "";
	haystack.split("").forEach((val, i) => {
		if (val != needle.charAt(i)) diff += val;
	});
	return diff;
}

/*
	Chat History
*/
const ChatHistory: string[] = [];
let cwm = ""; //current working message (index === -1)
let inputIndex = -1; //-1 = currently typed message, 0 = prev message sent, n = first message sent
export function getFromHistory(i: number | void) {
	if (i === -1 || (i === undefined && inputIndex === -1)) return cwm;
	return ChatHistory[i === undefined ? inputIndex : i];
}
export function setPrevHistory() {
	if (inputIndex + 1 > ChatHistory.length - 1) return;
	inputIndex++;
}
export function setNextHistory() {
	if (inputIndex - 1 < -1) return;
	inputIndex--;
}
function sendMsg(msg: string) {
	ws.send(msg);
	ChatHistory.splice(0, 0, msg);
	cwm = "";
}

/*
	ChatInput
*/
let delLoopRef: NodeJS.Timer | void;
let delStep = 0;
let toggleCounter = 0;
let toggleCounterRef: NodeJS.Timer | void;
export function ChatInput() {
	const { mode, chatVal } = useTheme();
	const setStore = useThemeUpdate();
	function emptyInput(text: string) {
		const newVal = " " + text.substr(2 + delStep);
		setStore((prevStore) => ({
			...prevStore,
			chatVal: newVal,
		}));
		delStep++;
		if (newVal === " ")
			delLoopRef = clearInterval(delLoopRef as NodeJS.Timer);
	}
	function parseText(text: string) {
		const isBackspace = !(chatVal.length < text.length);
		let char = findDiff(chatVal, text).trim();
		char = char || (isBackspace ? "Backspace" : "Space");
		if (char.length > 1 && char !== "Backspace" && char !== "Space")
			alert("wtf is going on here on this day"); //just in case, should never happen
		queueKey({
			code: char,
			shiftKey: false,
			type: "keydown",
		} as KeyboardEvent);
		queueKey({
			code: char,
			shiftKey: false,
			type: "keyup",
		} as KeyboardEvent);
		if (!isBackspace)
			setStore((prevStore) => ({
				...prevStore,
				chatVal: text,
			}));
	}
	function handleChangeText(text: string) {
		if (mode === "command") {
			parseText(text);
			delStep = 0;
			if (delLoopRef) delLoopRef = clearInterval(delLoopRef);
			delLoopRef = setInterval(() => emptyInput(text), 200);
		} else
			setStore((prevStore) => ({
				...prevStore,
				chatVal: text,
			}));
	}
	const [borderColor, setBorderColor] = useState(
		OS === "web" ? webFocus : mobileBlur
	); //web has auto-focus on input
	return (
		<KeyboardAvoidingView
			style={tw`absolute bottom-0 w-full items-center justify-center flex-auto`}
			behavior={OS === "ios" ? "padding" : "height"}
		>
			<HeldKeysComponent setBorderColor={setBorderColor} />
			<TextInput
				onPressIn={(e) => {
					//runs on mobile (only)
					toggleCounter++;
					if (toggleCounter % 3 === 0) {
						setStore((prevStore: xType) => ({
							...prevStore,
							mode: mode === "chat" ? "command" : "chat",
						}));
						toggleCounter = 0;
						setBorderColor(
							mode === "chat" ? mobileFocus : webFocus
						);
						if (toggleCounterRef)
							toggleCounterRef = clearTimeout(toggleCounterRef);
					} else {
						if (toggleCounterRef) return;
						toggleCounterRef = setTimeout(() => {
							toggleCounter = 0;
							toggleCounterRef = undefined;
						}, 1200);
					}
				}}
				style={[
					{
						...(OS === "web" ? { outlineColor: borderColor } : {}),
					},
					tw`w-3/4 bg-black bg-opacity-80 ios:bg-opacity-50 android:bg-opacity-50 text-white border-dashed border-l-2 border-t-2 border-r-2 border-b-2`,
					tw.style(
						borderColor === "orange" && tw`border-red-400`, //todo: why does border-orange-900 break? but not on web
						borderColor === "red" && tw`border-red-900`,
						borderColor === "green" && tw`border-green-900`
					),
				]}
				onFocus={(e) => {
					setBorderColor(
						OS === "web" || mode === "chat" ? webFocus : mobileFocus
					);
				}}
				onBlur={(e) => {
					setBorderColor(OS === "web" ? webBlur : mobileBlur);
				}}
				autoFocus={OS === "web"}
				blurOnSubmit={false}
				placeholder={"Enter a message [Press Enter]"}
				onChangeText={(text) => handleChangeText(text)}
				onKeyPress={(ev) => {
					const e: KeyboardEvent = ev as unknown as KeyboardEvent;
					if (e.key === "ArrowUp" || e.key === "ArrowDown") {
						if (inputIndex === -1) cwm = chatVal;
						if (e.key === "ArrowUp") setPrevHistory();
						if (e.key === "ArrowDown") setNextHistory();
						setStore((prevStore) => ({
							...prevStore,
							chatVal: getFromHistory(),
						}));
					}
				}}
				onSubmitEditing={(e) => {
					if (mode === "command") {
						//todo: queue Enter key
						console.log("Enter");
						return;
					}
					const msg = e.nativeEvent.text.trim();
					if (!msg) return;
					sendMsg(msg);
					setStore((prevStore) => ({
						...prevStore,
						chatVal: "",
					}));
				}}
				value={chatVal}
				selectTextOnFocus={true}
				autoCorrect={false}
			/>
		</KeyboardAvoidingView>
	);
}
