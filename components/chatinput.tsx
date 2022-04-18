import React, { useRef, useState } from "react";
import tw from "twrnc";
import { TextInput, KeyboardAvoidingView, View, Text } from "react-native";
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
import {
	getFromHistory,
	setNextHistory,
	setPrevHistory,
	logMessage,
	updateCurrentWorkingMessage,
} from "../src/keyboarding";

function findDiff(needle: string, haystack: string) {
	let diff = "";
	haystack.split("").forEach((val, i) => {
		if (val != needle.charAt(i)) diff += val;
	});
	return diff;
}

/*
	ChatInput
*/
let delLoopRef: NodeJS.Timer | void;
let delStep = 0;
let toggleCounter = 0;
let toggleCounterRef: NodeJS.Timer | void;
export function ChatInput() {
	const { mode, chatVal, chatLog } = useTheme();
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
	const [selection, setSelection] = useState({ start: 0, end: 0 });
	return (
		<KeyboardAvoidingView
			style={tw`absolute bottom-0 w-full items-center justify-center flex-auto`}
			behavior={OS === "ios" ? "padding" : "height"}
		>
			{
				/* chatLog */
				chatLog.map((msg, i) => {
					return (
						<View key={i} style={tw`w-full`}>
							<Text
								style={[
									tw`text-white`,
									{
										textShadowColor: "rgba(0, 0, 0, 0.8)",
										textShadowOffset: {
											width: 0,
											height: 0,
										},
										textShadowRadius: 10,
									},
								]}
							>
								{msg}
							</Text>
						</View>
					);
				})
			}

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
						updateCurrentWorkingMessage(chatVal);
						if (e.key === "ArrowUp") setPrevHistory();
						if (e.key === "ArrowDown") setNextHistory();
						const historyValue = getFromHistory();
						setStore((prevStore) => ({
							...prevStore,
							chatVal: historyValue,
						}));
						setTimeout(() => {
							setSelection({
								start: historyValue.length,
								end: historyValue.length,
							});
						});
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
					ws.send(msg);
					logMessage(msg);
					setStore((prevStore) => ({
						...prevStore,
						chatVal: "",
					}));
				}}
				value={chatVal}
				selectTextOnFocus={true}
				autoCorrect={false}
				selection={selection}
				onSelectionChange={({
					nativeEvent: { selection /*, text*/ },
				}) => setSelection(selection)}
			/>
		</KeyboardAvoidingView>
	);
}
