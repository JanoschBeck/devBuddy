import socket
import json
import time
import threading

class ScrollTestClient:
    def __init__(self, host='0.0.0.0', port=12345):
        self.host = host
        self.port = port
        self.socket = None
        self.connected = False
        
    def connect(self):
        """连接到服务器"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.host, self.port))
            self.connected = True
            print(f"[Client] 已连接到 {self.host}:{self.port}")
            
            # 启动接收线程
            receive_thread = threading.Thread(target=self.receive_messages)
            receive_thread.daemon = True
            receive_thread.start()
            
            return True
        except Exception as e:
            print(f"[Client] 连接失败: {e}")
            return False
    
    def receive_messages(self):
        """接收服务器消息"""
        buffer = ""
        while self.connected:
            try:
                data = self.socket.recv(1024).decode("utf-8")
                if not data:
                    break
                    
                buffer += data
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    if line.strip():
                        if line == "OK":
                            print("[Client] 服务器确认: OK")
                        else:
                            try:
                                response = json.loads(line)
                                if "response" in response:
                                    print(f"[Client] 服务器响应: {response['response']}")
                                elif "event" in response:
                                    print(f"[Client] 服务器事件: {response['event']}")
                            except json.JSONDecodeError:
                                print(f"[Client] 收到消息: {line}")
                                
            except Exception as e:
                print(f"[Client] 接收消息错误: {e}")
                break
    
    def send_message(self, message_dict):
        """发送消息到服务器"""
        if not self.connected:
            print("[Client] 未连接到服务器")
            return False
            
        try:
            message_json = json.dumps(message_dict) + "\n"
            self.socket.send(message_json.encode("utf-8"))
            return True
        except Exception as e:
            print(f"[Client] 发送消息失败: {e}")
            return False
    
    def disconnect(self):
        """断开连接"""
        self.connected = False
        if self.socket:
            self.socket.close()
            print("[Client] 已断开连接")

def test_continuation_text():
    """测试延续文字功能"""
    client = ScrollTestClient()
    
    if not client.connect():
        return
    
    try:
        # 测试场景1: 模拟AI对话回复过程
        print("\n=== 测试场景1: AI对话延续文字 ===")
        
        # 初始设置
        client.send_message({
            "status": "AI正在回复",
            "emoji": "🤖",
            "RGB": "#0066FF",
            "brightness": 80
        })
        time.sleep(1)
        
        # 模拟AI逐步生成回复
        conversation_parts = [
            "用户：你好，请介绍一下Python的特点。",
            "用户：你好，请介绍一下Python的特点。\n\nAI：Python是一种高级编程语言，",
            "用户：你好，请介绍一下Python的特点。\n\nAI：Python是一种高级编程语言，具有以下主要特点：\n\n1. 简洁易读",
            "用户：你好，请介绍一下Python的特点。\n\nAI：Python是一种高级编程语言，具有以下主要特点：\n\n1. 简洁易读：Python语法接近自然语言，",
            "用户：你好，请介绍一下Python的特点。\n\nAI：Python是一种高级编程语言，具有以下主要特点：\n\n1. 简洁易读：Python语法接近自然语言，代码可读性强。\n\n2. 跨平台性：",
            "用户：你好，请介绍一下Python的特点。\n\nAI：Python是一种高级编程语言，具有以下主要特点：\n\n1. 简洁易读：Python语法接近自然语言，代码可读性强。\n\n2. 跨平台性：可以在Windows、Linux、macOS等系统运行。\n\n3. 丰富的库生态：",
            "用户：你好，请介绍一下Python的特点。\n\nAI：Python是一种高级编程语言，具有以下主要特点：\n\n1. 简洁易读：Python语法接近自然语言，代码可读性强。\n\n2. 跨平台性：可以在Windows、Linux、macOS等系统运行。\n\n3. 丰富的库生态：拥有庞大的第三方库支持，涵盖Web开发、数据科学、人工智能等领域。\n\n4. 动态类型：",
            "用户：你好，请介绍一下Python的特点。\n\nAI：Python是一种高级编程语言，具有以下主要特点：\n\n1. 简洁易读：Python语法接近自然语言，代码可读性强。\n\n2. 跨平台性：可以在Windows、Linux、macOS等系统运行。\n\n3. 丰富的库生态：拥有庞大的第三方库支持，涵盖Web开发、数据科学、人工智能等领域。\n\n4. 动态类型：变量类型在运行时确定，提高开发效率。\n\n5. 解释执行：无需编译，直接执行，便于调试和快速原型开发。"
        ]
        
        for i, part in enumerate(conversation_parts):
            print(f"[Test] 发送文本片段 {i+1}/{len(conversation_parts)}")
            client.send_message({
                "text": part,
                "scroll_speed": 2
            })
            time.sleep(2)  # 模拟AI生成文字的间隔
        
        # 等待滚动完成
        time.sleep(5)
        
        # 测试场景2: 非延续文字（新话题）
        print("\n=== 测试场景2: 新话题（非延续文字） ===")
        client.send_message({
            "status": "新话题开始",
            "emoji": "💭",
            "text": "让我们换个话题。今天天气真不错，阳光明媚，微风习习。这样的好天气最适合出去散步了。你有什么户外活动的计划吗？",
            "RGB": "#00FF66"
        })
        time.sleep(3)
        
        # 测试场景3: 实时日志模拟
        print("\n=== 测试场景3: 实时日志延续 ===")
        client.send_message({
            "status": "系统日志",
            "emoji": "📊",
            "RGB": "#FF6600"
        })
        
        log_entries = [
            "[2025-08-10 14:30:01] 系统启动完成",
            "[2025-08-10 14:30:01] 系统启动完成\n[2025-08-10 14:30:02] 加载配置文件",
            "[2025-08-10 14:30:01] 系统启动完成\n[2025-08-10 14:30:02] 加载配置文件\n[2025-08-10 14:30:03] 连接数据库成功",
            "[2025-08-10 14:30:01] 系统启动完成\n[2025-08-10 14:30:02] 加载配置文件\n[2025-08-10 14:30:03] 连接数据库成功\n[2025-08-10 14:30:04] 启动Web服务器",
            "[2025-08-10 14:30:01] 系统启动完成\n[2025-08-10 14:30:02] 加载配置文件\n[2025-08-10 14:30:03] 连接数据库成功\n[2025-08-10 14:30:04] 启动Web服务器\n[2025-08-10 14:30:05] 所有服务运行正常",
            "[2025-08-10 14:30:01] 系统启动完成\n[2025-08-10 14:30:02] 加载配置文件\n[2025-08-10 14:30:03] 连接数据库成功\n[2025-08-10 14:30:04] 启动Web服务器\n[2025-08-10 14:30:05] 所有服务运行正常\n[2025-08-10 14:30:06] 用户认证模块加载",
            "[2025-08-10 14:30:01] 系统启动完成\n[2025-08-10 14:30:02] 加载配置文件\n[2025-08-10 14:30:03] 连接数据库成功\n[2025-08-10 14:30:04] 启动Web服务器\n[2025-08-10 14:30:05] 所有服务运行正常\n[2025-08-10 14:30:06] 用户认证模块加载\n[2025-08-10 14:30:07] 缓存系统初始化完成"
        ]
        
        for i, log_text in enumerate(log_entries):
            print(f"[Test] 发送日志更新 {i+1}/{len(log_entries)}")
            client.send_message({
                "text": log_text,
                "scroll_speed": 3
            })
            time.sleep(1.5)
        
        time.sleep(3)
        
        # 测试场景4: 电池状态变化
        
        # 测试场景5: 混合更新（状态+延续文字）
        print("\n=== 测试场景5: 混合更新测试 ===")
        
        story_parts = [
            "从前有一个小村庄，",
            "从前有一个小村庄，村里住着一位善良的老奶奶。",
            "从前有一个小村庄，村里住着一位善良的老奶奶。她每天都会在花园里种花，",
            "从前有一个小村庄，村里住着一位善良的老奶奶。她每天都会在花园里种花，花园里开满了各种美丽的花朵。有一天，",
            "从前有一个小村庄，村里住着一位善良的老奶奶。她每天都会在花园里种花，花园里开满了各种美丽的花朵。有一天，一只受伤的小鸟飞到了她的花园里。老奶奶悉心照料这只小鸟，"
        ]
        
        emojis = ["📖", "🏡", "🌸", "🌺", "🐦"]
        statuses = ["开始", "设定", "日常", "转折", "照料"]
        
        for i, (story, emoji, status) in enumerate(zip(story_parts, emojis, statuses)):
            client.send_message({
                "status": f"故事阶段: {status}",
                "emoji": emoji,
                "text": story,
                "scroll_speed": 2
            })
            time.sleep(3)
        
        print("\n=== 测试完成，等待最后滚动... ===")
        time.sleep(5)
        
    except KeyboardInterrupt:
        print("\n[Test] 测试被用户中断")
    finally:
        client.disconnect()

def test_performance():
    """性能测试：发送超长文本"""
    client = ScrollTestClient()
    
    if not client.connect():
        return
    
    try:
        print("\n=== 性能测试: 超长文本 ===")
        
        # 生成超长文本
        long_text_parts = []
        base_text = "这是一个性能测试，用来验证优化后的滚动渲染系统能否高效处理长文本内容。"
        
        for i in range(10):
            accumulated_text = ""
            for j in range(i + 1):
                accumulated_text += f"第{j+1}段：{base_text} " * (j + 1) + "\n\n"
            long_text_parts.append(accumulated_text.strip())
        
        client.send_message({
            "status": "性能测试",
            "emoji": "⚡",
            "RGB": "#9900FF",
            "brightness": 90
        })
        
        for i, text_part in enumerate(long_text_parts):
            print(f"[Performance] 发送文本片段 {i+1}/{len(long_text_parts)} (长度: {len(text_part)} 字符)")
            start_time = time.time()
            
            client.send_message({
                "text": text_part,
                "scroll_speed": 4  # 更快的滚动速度用于测试
            })
            
            send_time = time.time() - start_time
            print(f"[Performance] 发送耗时: {send_time:.3f}秒")
            time.sleep(2)
        
        print("[Performance] 性能测试完成")
        time.sleep(3)
        
    except KeyboardInterrupt:
        print("\n[Performance] 性能测试被中断")
    finally:
        client.disconnect()

def test_interactive_chat():
    """交互式聊天测试"""
    client = ScrollTestClient()
    
    if not client.connect():
        return
    
    try:
        print("\n=== 交互式聊天测试 ===")
        print("输入消息发送到显示屏，输入 'quit' 退出")
        
        # 初始设置
        client.send_message({
            "status": "聊天模式",
            "emoji": "💬",
            "RGB": "#00CCFF",
            "brightness": 85,
        })
        
        conversation_history = ""
        
        while True:
            user_input = input("\n请输入消息: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                break
            
            if user_input:
                # 添加到对话历史
                if conversation_history:
                    conversation_history += f"\n\n用户: {user_input}"
                else:
                    conversation_history = f"用户: {user_input}"
                
                client.send_message({
                    "text": conversation_history,
                    "scroll_speed": 2
                })
                
                # 模拟AI回复
                time.sleep(1)
                ai_response = f"AI: 我收到了您的消息「{user_input}」，这是一个很有趣的话题！"
                conversation_history += f"\n\nAI: {ai_response}"
                
                client.send_message({
                    "text": conversation_history,
                    "scroll_speed": 2
                })
        
    except KeyboardInterrupt:
        print("\n[Interactive] 交互测试被中断")
    finally:
        client.disconnect()

def main():
    """主测试函数"""
    print("滚动文字测试客户端")
    print("===================")
    print("1. 基础延续文字测试")
    print("2. 性能测试（超长文本）")
    print("3. 交互式聊天测试")
    print("4. 综合测试（全部运行）")
    
    choice = input("\n请选择测试类型 (1-4): ").strip()
    
    if choice == "1":
        test_continuation_text()
    elif choice == "2":
        test_performance()
    elif choice == "3":
        test_interactive_chat()
    elif choice == "4":
        print("\n开始综合测试...")
        test_continuation_text()
        time.sleep(2)
        test_performance()
        time.sleep(2)
        test_interactive_chat()
    else:
        print("无效选择，运行基础测试...")
        test_continuation_text()

if __name__ == "__main__":
    main()