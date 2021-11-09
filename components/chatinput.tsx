import React, { useRef, useState } from "react";
import { TextInput, KeyboardAvoidingView } from "react-native";
import { addQueue, HeldKeysComponent, queueKey } from "../src/keyboarding";
import { useTheme } from "../src/theme-context";
const webBlur = "red", //textinput border colors
	webFocus = "green",
	mobileBlur = "orange",
	mobileFocus = "red";

function findDiff(needle: string, haystack: string) {
	let diff = "";
	haystack.split("").forEach(function (val, i) {
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
		if (newVal === " ")
			delLoopRef = clearInterval(delLoopRef as NodeJS.Timer);
	}
	function parseText(text: string) {
		const isBackspace = !(cur.length < text.length);
		let char = findDiff(cur, text).trim();
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
	const [borderColor, setBorderColor] = useState(
		OS === "web" ? webFocus : mobileBlur //web has auto-focus on input
	);
	return (
		<KeyboardAvoidingView
			style={{
				position: "absolute",
				bottom: 0,
				width: "100%",
				alignItems: "center",
				flex: 1,
				justifyContent: "center",
			}}
			behavior={OS === "ios" ? "padding" : "height"}
		>
			<HeldKeysComponent />
			<TextInput
				style={{
					borderColor,
					borderStyle: "dashed",
					borderLeftWidth: 1,
					borderTopWidth: 1,
					borderRightWidth: 1,
					borderBottomWidth: 1,
					width: "75%",
					color: "white",
					backgroundColor: `rgba(0, 0, 0, 0.${OS === "web" ? 8 : 5})`,
					...(OS === "web" ? { outlineColor: borderColor } : {}),
				}}
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
