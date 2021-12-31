import React, { useRef, useState } from "react";
import tw from 'twrnc';
import { TextInput, KeyboardAvoidingView } from "react-native";
import { addQueue, HeldKeysComponent, queueKey } from "../src/keyboarding";
import { useTheme } from "../src/theme-context";

const webBlur = "red", //textinput border colors
	webFocus = "green",
	mobileBlur = "orange",
	mobileFocus = "red";

function findDiff(needle: string, haystack: string) {
	let diff = "";
	haystack.split("").forEach((val, i) => {
		if (val != needle.charAt(i)) diff += val;
	});
	return diff;
}

let delLoopRef: NodeJS.Timer | void;
let delStep = 0;
export function ChatInput() {
	const { mode } = useTheme();
	function emptyInput(text: string) {
		const newVal = " " + text.substr(2 + delStep);
		setCur(newVal);
		delStep++;
		if (newVal === " ") delLoopRef = clearInterval(delLoopRef as NodeJS.Timer);
	}
	function parseText(text: string) {
		const isBackspace = !(cur.length < text.length);
		let char = findDiff(cur, text).trim();
		char = char || (isBackspace ? "Backspace" : "Space");
		if (char.length > 1 && char !== "Backspace" && char !== "Space") alert("wtf is going on here on this day"); //just in case, should never happen
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
		if (!isBackspace) setCur(text);
	}
	function handleChangeText(text: string) {
		if (mode === "command") {
			parseText(text);
			delStep = 0;
			if (delLoopRef) delLoopRef = clearInterval(delLoopRef);
			delLoopRef = setInterval(() => emptyInput(text), 200);
		} else setCur(text);
	}
	const [cur, setCur] = useState(mode === "command" ? " " : "");
	const [borderColor, setBorderColor] = useState(OS === "web" ? webFocus : mobileBlur);  //web has auto-focus on input
	return (
		<KeyboardAvoidingView
			style={tw`absolute bottom-0 w-full items-center justify-center flex-auto`}
			behavior={OS === "ios" ? "padding" : "height"}
		>
			<HeldKeysComponent />
			<TextInput
				style={[{
					...(OS === "web" ? { outlineColor: borderColor } : {}),
				}, tw`w-3/4 bg-black bg-opacity-${OS === "web" ? 80 : 50} text-white border-dashed border-${borderColor}-900 border-l-2 border-t-2 border-r-2 border-b-2`]}
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
				onSubmitEditing={(e) => {
					if (mode === "command") {
						//todo: queue Enter key
						console.log("Enter");
						return;
					}
					const msg = e.nativeEvent.text.trim();
					if (!msg) return;
					ws.send(msg);
					setCur("");
				}}
				value={cur}
				selectTextOnFocus={true}
				autoCorrect={false}
			/>
		</KeyboardAvoidingView>
	);
}
